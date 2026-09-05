# Learning notes

Reference notes written while building this app. Aimed at a frontend-leaning
engineer who wants to understand the data layer well enough to reason about it,
not to specialise in it.

---

# Part 1 — tRPC

## The one idea

tRPC has no codegen and no schema file. There is no `.proto`, no GraphQL SDL,
no generated client to regenerate when the API changes.

Instead, **one TypeScript type crosses the client/server boundary by import.**
You write server functions, export their _type_, and the client imports that
type. At build time the type is erased, so nothing server-side ships to the
browser — but the client gets full autocomplete and compile errors.

That's the whole trick. Everything else is plumbing.

## The four pieces

```
apps/web/
├── server/trpc.ts                    1. init + context
├── server/router.ts                  2. the API surface
├── app/api/trpc/[trpc]/route.ts      3. the HTTP adapter
└── trpc/client.ts                    4. the browser client
```

### 1. Init — `server/trpc.ts`

```ts
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

Called once per app. Returns two builders: `router` (groups procedures) and
`procedure` (defines one). Export the pieces, not `t`.

**Context** is built fresh per request and passed to every procedure. It's where
request-scoped dependencies go — the database handle now, the logged-in user
later.

```ts
export function createContext() {
  return { db };
}
```

### 2. Router — `server/router.ts`

```ts
export const appRouter = router({
  blunders: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(25) }))
      .output(z.array(blunder))
      .query(({ ctx, input }) => {
        /* ... */
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

- Routers **nest** — that's how you get `trpc.blunders.list` instead of a flat
  pile of names.
- `.query()` = read, `.mutation()` = write. The difference is HTTP verb (GET vs
  POST) and cacheability.
- That last export line is the entire contract.

### 3. Adapter — `app/api/trpc/[trpc]/route.ts`

```ts
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

Your whole API is **one** Next.js route. The `[trpc]` catch-all captures the
procedure path from the URL; the adapter looks it up, runs it, serialises the
result.

> **Gotcha:** App Router requires named method exports. `export default handler`
> gives you a 405.

### 4. Client — `trpc/client.ts`

```ts
import type { AppRouter } from "@/server/router";

export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});
```

> **Gotcha:** `import type` is load-bearing. It's erased at compile time, so no
> server code, no database driver, no filesystem paths reach the browser. A
> plain `import` would drag all of it in.

`httpBatchLink` collects calls fired in the same tick into a single HTTP
request. Three components asking for data on mount = one request.

## It's just HTTP

The most useful thing to internalise. You can curl it:

```
GET /api/trpc/blunders.list?input={"limit":2}

{"result":{"data":[{"blunder_id":12069561,"kind":"checker", ... }]}}
```

Procedure path in the URL, input as a JSON query param, result under
`result.data`. Batched calls look like `?batch=1&input={"0":{...}}` and return
an array.

Nothing magic is happening at the transport layer.

## Validation runs both directions

`.input()` and `.output()` are the same mechanism pointed opposite ways.

**`.input(schema)`** does double duty:

- _Runtime:_ validates and rejects bad input with a 400.
- _Compile time:_ infers the type of `input` in your handler — you never
  annotate it.

```
GET /api/trpc/blunders.list?input={"limit":9999}
→ {"error":{"message":"Too big: expected number to be <=200",
             "data":{"code":"BAD_REQUEST","httpStatus":400}}}
```

This is worth understanding properly: **TypeScript types vanish at runtime.**
They protect you from nothing at a network boundary. zod is the runtime half.

**`.output(schema)`** validates what you send back. It catches the case where
your data source quietly returns a different shape than you promised:

```
→ {"error":{"message":"Output validation failed",
             "data":{"code":"INTERNAL_SERVER_ERROR","httpStatus":500}}}
```

A 500 on the server, rather than a malformed object reaching your component and
exploding as `undefined` three renders later.

Trade-off: it costs a parse on every response and turns a data problem into a
hard failure. Most teams apply it to boundaries they don't fully control.

## Types flow to the client for free

This is the payoff, and it's entirely a frontend concern.

```ts
// server — type derived from the zod schema
type Blunder = z.infer<typeof blunder>;

// client — type derived from the router
type Blunder = inferRouterOutputs<AppRouter>["blunders"]["list"][number];
```

`inferRouterOutputs` is the one to memorise. Your component derives its types
**from the API itself** — no shared types package, no duplicated interface,
nothing to keep in sync. Change the procedure and the component's types move
with it.

There is also `inferRouterInputs<AppRouter>` for the argument side.

## Monorepo notes

Two things that cost time when importing a workspace package into a Next app:

**Package name is the alias.** In a pnpm workspace you import by package name —
`@repo/galaxy-scraper`. No tsconfig `paths` entry needed.

**`exports` is an allowlist.** Subpaths are blocked unless listed:

```jsonc
"exports": {
  ".": "./src/index.ts",
  "./types": "./src/types.ts",
  "./config": "./src/config.ts"
}
```

**Packages shipping raw `.ts` need `transpilePackages`** in `next.config.js`,
plus `allowImportingTsExtensions` in the app's tsconfig if the package's own
imports carry `.ts` extensions.

**Barrel imports pull everything.** Importing one constant from a package's
`index.ts` drags in every module it re-exports. We hit a real Turbopack warning
about filesystem tracing this way, and fixed it by importing a narrow subpath
instead.

## What we deliberately skipped

- **Mutations** — same as queries, `.mutation()` instead of `.query()`.
- **Middleware** — how you build `protectedProcedure` from `publicProcedure`.

Server-side calls are no longer skipped — see Part 1.5.

---

# Part 1.5 — Server Components

The app has two ways to call the same procedures. Which one you reach for is the
main architectural decision in a Next.js app.

## Two callers, same router

```ts
// trpc/client.ts — browser. Goes over HTTP.
export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});

// server/caller.ts — Server Components. No network at all.
export const caller = createCallerFactory(appRouter)(createContext);
```

`createCallerFactory` invokes procedures as **plain functions**. No fetch, no
serialisation, no round trip — the query runs during render and its result is
baked into the HTML.

```tsx
export async function CategoryNav() {
  const categories = await caller.categories.list();
  // ...
}
```

Server Components can be `async`. There is no `useEffect`, no loading state, and
no waterfall — the data is already there when the HTML is written.

> **Gotcha:** `import "server-only"` at the top of `caller.ts` makes the build
> fail loudly if a Client Component ever imports it. Worth adding, because the
> failure it prevents — leaking the database handle into a client bundle — is
> otherwise silent.
>
> Note it must be a **real dependency**. TypeScript does not fail resolution on
> side-effect-only imports, and Turbopack aliases the package internally, so a
> missing `server-only` type-checks and runs fine right up until it doesn't.

## The shape of the app

The split we landed on, and the reasoning:

| Data                    | Where          | Why                                   |
| ----------------------- | -------------- | ------------------------------------- |
| Category list + counts  | Server (RSC)   | Changes rarely, needed on first paint |
| Blunders for a category | Client         | Changes on every navigation           |
| Which blunder is active | Client (state) | Pure interaction, no fetch            |

Slow-moving data server-side, interactive data client-side. That's the general
rule, and it's usually a better starting point than "fetch everything on the
client."

## Layouts persist across navigation

`CategoryNav` lives in `app/layout.tsx`, not in the page. Next reuses a layout
across navigations between its children, so clicking through categories does
**not** re-run the category query. Only the page below it re-renders.

This is a real performance property, not a detail — putting the nav in each page
instead would re-query on every click.

## ⚠️ Static vs Dynamic — revisit this

`next build` labels every route:

```
┌ ○ /                    ← Static: rendered once at BUILD time
├ ƒ /[category]          ← Dynamic: rendered per request
└ ƒ /api/trpc/[trpc]
```

`○ Static` means the sidebar counts were computed **when the app was built** and
frozen into the HTML. Re-running the scraper will not change them until the next
deploy.

This is currently wrong for us, and is left as-is deliberately so the trade-off
stays visible. The fix is one line:

```ts
export const revalidate = 3600; // ISR: regenerate at most hourly
export const dynamic = "force-dynamic"; // or: always fresh, never cached
```

**The trap worth remembering:** a Server Component that reads a database looks
identical whether it runs once at build time or on every request. Nothing in the
component tells you which. The only signal is the `○` / `ƒ` in the build output —
so read it.

## The open problem → Part 2

`app/[category]/blunder-browser.tsx` still fetches by hand:

```tsx
useEffect(() => {
  setBlunders(null);
  setActiveId(null);
  trpc.blunders.byCategory.query({ category }).then(setBlunders);
}, [category]);
```

This works, and it's deliberately explicit so the request stays visible. But it
has real problems, and now that `category` is a prop they are no longer
hypothetical:

- no error handling — a rejected promise is swallowed
- no cleanup — navigate fast and a stale response can overwrite a newer one
- no caching — going back to a category refetches from scratch
- manual reset of two pieces of state on every change
- no way to invalidate or refetch on demand

Every one of those is what TanStack Query exists to solve. Part 2 refactors this
exact file so the before/after is the lesson.

---

# Part 2 — TanStack Query

_Not written yet._
