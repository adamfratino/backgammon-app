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
- **Server-side calls** — `createCallerFactory` lets a React Server Component
  call a procedure directly, skipping the HTTP round trip.

## The open problem → Part 2

`app/blunders.tsx` currently fetches like this:

```tsx
useEffect(() => {
  trpc.blunders.list.query({ limit: 10 }).then(setBlunders);
}, []);
```

This works, and it's deliberately simple so the request is visible. But it has
real problems:

- no error handling
- no cleanup on unmount
- if `limit` became a prop, it would refetch and race on every change
- no caching — remount refetches
- no way to invalidate or refetch on demand

Every one of those is what TanStack Query exists to solve. Part 2 refactors this
exact file so the before/after is the lesson.

---

# Part 2 — TanStack Query

_Not written yet._
