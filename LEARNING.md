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

## The one idea

`useState` + `useEffect` treats server data as if you own it. You don't. It is a
**local replica of something that lives somewhere else and can change without
telling you.**

TanStack Query is not a fetching library. It is a cache with a fetching policy.
You never say "go fetch now". You declare _what this component needs_, under a
key, and the cache decides whether the copy it already has is good enough.

Everything else — deduplication, background refetch, retries, staleness — falls
out of that one reframing.

## Two integrations. Pick the right one.

There are two tRPC packages for this and they are not interchangeable:

| package                      | call style                                                      | status                    |
| ---------------------------- | --------------------------------------------------------------- | ------------------------- |
| `@trpc/react-query`          | `trpc.blunders.byCategory.useQuery({ category })`               | classic, still maintained |
| `@trpc/tanstack-react-query` | `useQuery(trpc.blunders.byCategory.queryOptions({ category }))` | current — what we use     |

The classic package wraps every TanStack hook, so tRPC sits permanently in the
middle. The new one wraps nothing: `queryOptions()` returns a **plain options
object**. That object composes with every TanStack API that accepts one —
`useQuery`, `useSuspenseQuery`, `useQueries`, `prefetchQuery`, `setQueryData`.
tRPC's only job becomes building the key and the fetcher.

> **Gotcha:** most tutorials and most of the internet are still the classic API.
> If you see `.useQuery()` hanging off the tRPC object, you are reading the old
> one and it will not work here.

## Install

```sh
pnpm --filter web add @tanstack/react-query @trpc/tanstack-react-query
pnpm --filter web add -D @tanstack/react-query-devtools
```

`@trpc/tanstack-react-query` ships on tRPC's version line, not TanStack's. Keep
it pinned to the same version as `@trpc/server` and `@trpc/client` — `11.18.0`
here. `@tanstack/react-query` versions independently (v5).

## The four pieces

```
apps/web/
├── trpc/query-client.ts                 1. the cache, configured
├── trpc/client.tsx                      2. provider + useTRPC   (was client.ts)
├── app/layout.tsx                       3. mount the provider
└── app/[category]/blunder-browser.tsx   4. the refactor — the actual lesson
```

### 1. The cache — `trpc/query-client.ts`

New file.

```ts
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // How long a fetched result is trusted without re-checking. The default
        // is 0, which means every new mount refetches immediately — technically
        // correct, and the reason people conclude the cache "isn't working".
        staleTime: 60 * 1000,
      },
    },
  });
}
```

**`staleTime` is the one option to understand.** It answers: _how long may I
serve this without asking again?_ At the default of `0`, mounting a component
always triggers a request; you still get deduplication and background updates,
but not the instant navigation you probably wanted.

Do not confuse it with `gcTime` (default 5 minutes), which answers a different
question: _how long do I keep this around after nothing is rendering it?_
`staleTime` governs refetching; `gcTime` governs eviction.

**Why a factory, not a module-level `new QueryClient()`.** In Next this module
is evaluated on the server too. A module-level singleton there would be shared
across every concurrent request — one visitor's cache serving another's
response. A factory lets us make exactly one client per server request, and
exactly one for the browser tab.

### 2. Provider and hook — `trpc/client.tsx`

This replaces the existing `trpc/client.ts`. It gains JSX, so it needs the new
extension:

```sh
git mv apps/web/trpc/client.ts apps/web/trpc/client.tsx
```

```tsx
"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { makeQueryClient } from "@/trpc/query-client";
import type { AppRouter } from "@/server/router";

/**
 * The typed proxy and its provider. `useTRPC()` returns an object shaped like
 * the router, where every procedure exposes `queryOptions`, `queryKey`,
 * `queryFilter`, `mutationOptions` — builders, not hooks.
 */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // Server: a fresh cache per request, never shared between visitors.
  if (typeof window === "undefined") return makeQueryClient();
  // Browser: one cache for the tab's whole lifetime. Re-making it here would
  // silently throw away everything cached so far.
  return (browserQueryClient ??= makeQueryClient());
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  // useState's initialiser runs once per mount, so the client is built once
  // rather than rebuilt on every render.
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc" })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

Notice the vanilla `trpc` export from Part 1 is gone. Its only consumer was
`blunder-browser.tsx`, which is the file we are about to rewrite. (The comment
in `server/caller.ts` points at `trpc/client.ts` by name — update it.)

> **Gotcha:** two providers, and both are required. `QueryClientProvider` is
> TanStack's; `TRPCProvider` is tRPC's, and it needs the _same_ `queryClient`
> instance handed to it. Miss `QueryClientProvider` and you get a runtime
> `No QueryClient set` on first render.

> **Gotcha:** the relative URL `/api/trpc` only resolves in a browser. It is
> fine here because this client is used exclusively from Client Components. If
> you ever call _this_ client from the server it would have to become absolute —
> Part 2.5 sidesteps that entirely by calling the router directly rather than
> over HTTP.

`import type { AppRouter }` is still load-bearing, for exactly the reason in
Part 1 — it is erased at compile time, so no server code follows it into the
bundle.

### 3. Mount it — `app/layout.tsx`

```tsx
import { CategoryNav } from "./category-nav";
import { TRPCReactProvider } from "@/trpc/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", gap: "3rem" }}>
        <TRPCReactProvider>
          {/* Still rendered on the server. Passing a Server Component through
              a client provider as children does not make it a client
              component — see below. */}
          <CategoryNav />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
```

> **Gotcha — the RSC rule worth memorising:** wrapping your tree in a
> `"use client"` provider does **not** turn the tree into client components.
> `layout.tsx` is a Server Component, so `<CategoryNav />` is evaluated _there_
> and its finished output is passed to the provider as `children`. The provider
> renders a slot it never owns.
>
> This only holds because the components arrive **as children**. If
> `TRPCReactProvider` imported `CategoryNav` itself, that import would drag it —
> and the database handle behind it — across the boundary, and `server-only`
> would fail the build. Composition is what keeps the boundary honest.

`CategoryNav` still uses `caller` and never touches TanStack Query. Part 1.5's
split is unchanged: slow-moving data on the server, interactive data on the
client.

### 4. The refactor — `app/[category]/blunder-browser.tsx`

The whole point of Part 2. Here is what leaves:

```tsx
const [blunders, setBlunders] = useState<Blunder[] | null>(null);
const [activeId, setActiveId] = useState<number | null>(null);

useEffect(() => {
  setBlunders(null);
  setActiveId(null);
  trpc.blunders.byCategory.query({ category }).then(setBlunders);
}, [category]);
```

And what replaces it:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/server/router";

type Blunder = inferRouterOutputs<AppRouter>["blunders"]["byCategory"][number];

export function BlunderBrowser({ category }: { category: string }) {
  const trpc = useTRPC();
  const [activeId, setActiveId] = useState<number | null>(null);

  const blunders = useQuery(trpc.blunders.byCategory.queryOptions({ category }));

  if (blunders.isPending) return <p>Loading...</p>;
  if (blunders.error) return <p role="alert">Could not load blunders: {blunders.error.message}</p>;
  if (blunders.data.length === 0) return <p>No blunders in this category.</p>;

  const active = blunders.data.find((b) => b.blunder_id === activeId) ?? null;

  return (
    <>
      <ol>
        {blunders.data.map((blunder) => (
          <li key={blunder.blunder_id}>
            <button
              type="button"
              aria-current={blunder.blunder_id === activeId}
              onClick={() => setActiveId(blunder.blunder_id)}
            >
              {blunder.kind} {blunder.error_magnitude.toFixed(3)}
            </button>
          </li>
        ))}
      </ol>

      {active ? <BlunderDetail blunder={active} /> : null}
    </>
  );
}
```

`BlunderDetail` is untouched.

Note `const trpc = useTRPC()` shadows the name the old import used. It is the
same spelling and a completely different thing: Part 1's `trpc` was a client
that _executes_ calls; this one only _describes_ them.

> **Gotcha — you need both guards, not one.** `useQuery` returns a
> **discriminated union**: pending, error, and success are distinct shapes, and
> only the success one carries a non-`undefined` `data`. Returning out of
> `isPending` alone is not enough, because the error variant has no data either:
>
> ```tsx
> if (blunders.isPending) return <p>Loading...</p>;
> blunders.data.length; // ✗ 'data' is possibly 'undefined' — the error variant
> ```
>
> Guard both and `data` narrows to `Blunder[]`, with no `?.` anywhere below. The
> order of the two checks does not matter.

Destructuring is fine here, incidentally —
`const { data, isPending, error } = useQuery(...)` narrows exactly the same way,
because TypeScript 4.6 added narrowing for destructured discriminated unions. A
lot of older advice tells you to keep the object for this reason; that advice
predates the feature. The one thing that _does_ break it is `let` — narrowing
applies only to `const` bindings.

## `key` does the other half

The old `useEffect` was quietly doing **two** jobs — refetching the data, and
resetting `activeId` so a selection didn't survive into a different category.
Query takes the first job. It has no opinion about the second.

Left alone, this is now a real bug: a blunder can belong to several categories
(that is what `blunder_categories` is), so a stale `activeId` can still match a
row in the category you just navigated to, and the detail pane silently shows a
selection you never made.

The React answer is not another effect. It is `key`, in `app/[category]/page.tsx`:

```tsx
<BlunderBrowser key={category} category={category} />
```

A changed `key` remounts the component, and remounting resets its state. State
that is only meaningful for one value of a prop should be keyed on that prop.
Reaching for `useEffect` to reset state is the anti-pattern this replaces.

## What each defect became

Part 1.5 listed five problems. Mapping them:

| Part 1.5 complaint               | What fixes it                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| no error handling                | `blunders.error` — a rejected promise becomes a render branch                                                   |
| no cleanup, stale overwrite      | cache keyed by input; a late response for category A writes to A's entry, and the component is only reading B's |
| no caching                       | one entry per key, plus `staleTime`                                                                             |
| manual reset of two state slices | data reset is implicit in the key change; `activeId` reset moves to `key`                                       |
| no way to invalidate or refetch  | `queryClient.invalidateQueries(...)` / `blunders.refetch()`                                                     |

The race condition deserves the extra beat, because it is the one people get
wrong by hand. The old code had no guard at all: navigate fast enough and A's
slower response lands after B's and calls `setBlunders` with the wrong list.
Query cannot express that bug — responses are filed under the key they were
requested with, and a component reads only the key it asked for.

## The query key

`queryOptions({ category })` builds a key from the procedure path and the input,
roughly:

```
[["blunders", "byCategory"], { input: { category: "blitz" }, type: "query" }]
```

Path plus input, which is why `blitz` and `middle_game` are separate cache
entries and switching between them is instant on the second visit. You can get
it directly when you need it:

```ts
const key = trpc.blunders.byCategory.queryKey({ category });
```

## Invalidation

Marking data stale so it refetches:

```ts
const queryClient = useQueryClient();

// every cached category
queryClient.invalidateQueries(trpc.blunders.byCategory.queryFilter());

// just this one
queryClient.invalidateQueries(trpc.blunders.byCategory.queryFilter({ category }));
```

> **Gotcha:** the classic package's `utils.blunders.invalidate()` does not exist
> here. Invalidation goes through `queryClient` with a `queryFilter()` from the
> proxy.

## `isPending` vs `isFetching` vs `isLoading`

Reliably confusing, and worth getting straight once:

| flag         | means                                                              |
| ------------ | ------------------------------------------------------------------ |
| `isPending`  | no data in cache yet — nothing to render                           |
| `isFetching` | a request is in flight _right now_, including a background refresh |
| `isLoading`  | `isPending && isFetching` — the first load, specifically           |

A background refetch over cached data is `isFetching: true` with
`isPending: false`. Render the stale data and a subtle indicator; do not throw
the user back to "Loading...". That distinction is most of what makes an app
built on this feel quick.

> **Gotcha:** v4 called the first-load flag `isLoading` and it was renamed to
> `isPending` in v5. Answers written for v4 will mislead you here.

## Devtools

Worth mounting inside `TRPCReactProvider` while learning — it is the only way to
_see_ any of the above:

```tsx
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

<QueryClientProvider client={queryClient}>
  <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
    {children}
    <ReactQueryDevtools initialIsOpen={false} />
  </TRPCProvider>
</QueryClientProvider>;
```

It is excluded from production builds automatically. Two things to try:

1. Click through three categories, then go back to the first. Watch the network
   tab stay quiet — that is `staleTime`.
2. Set `staleTime: 0`, repeat, and watch a request fire every time.

## What we deliberately skipped

- **Mutations** — `useMutation(trpc.x.mutationOptions())`, plus optimistic
  updates. Blocked on a writable database (see below), not on anything here.
- **Prefetching and hydration in RSC** — starting a query on the server and
  handing the promise to the client so there is no loading state at all. It is
  the natural sequel, and it needs the absolute-URL fix noted above.
- **`useSuspenseQuery`** — moves the pending branch into a `<Suspense>`
  boundary and deletes `isPending` from the component.
- **Infinite queries** — `blunders.byCategory` is capped at 200 by its own zod
  schema, so pagination has not become a problem yet.

## Still open

- The `⚠️ Static vs Dynamic` caveat from Part 1.5 is still unaddressed. `/` is
  prerendered at build time and the sidebar counts remain frozen until the next
  deploy. TanStack Query changes nothing about it — that is server-side caching,
  a different mechanism entirely, and worth not conflating.
- The database is a read-only local SQLite file, so the app cannot deploy and
  cannot persist anything. Tracked as BG-2, and it is what has to land before
  mutations mean anything.

---

# Part 2.5 — Prefetch and Hydration

## The problem Part 2 leaves behind

Part 2 fixed how the browser fetches. It did not change **when**. Ask the server
for `/blitz` and read what actually comes back over the wire:

```sh
curl -s http://localhost:3000/blitz | grep -c "Loading"
```

The rows are not in the HTML. The document arrives, the JS bundle downloads,
React hydrates, `useQuery` fires, an HTTP request goes to `/api/trpc`, and
_then_ SQLite is read. Every step after the first is avoidable — the server had
the database open when it wrote that HTML and chose to send "Loading..."
instead.

This is the same observation as Part 1.5, pointed at a harder case. `CategoryNav`
solved it by not being a Client Component at all. `BlunderBrowser` cannot do
that; it owns `activeId` and has to stay interactive. Prefetching is how you get
server-rendered data into a component that still needs to be a client one.

## The idea

Run the query on the server during render, put the result in a query cache,
serialise that cache into the HTML, and let the browser's `QueryClient` adopt it
on startup. `useQuery` then finds its entry already populated and never enters
`isPending` at all.

Three pieces: a proxy that calls the router directly, `dehydrate()` on the way
out, `HydrationBoundary` on the way in.

## 1. A server-side proxy — `trpc/server.tsx`

New file.

```tsx
import "server-only";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { appRouter } from "@/server/router";
import { createContext } from "@/server/trpc";
import { makeQueryClient } from "@/trpc/query-client";

/**
 * One QueryClient per request. `cache()` memoises for the lifetime of a single
 * server render, so the page and the dehydration step share an instance.
 */
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});
```

**How this differs from `caller` (Part 1.5).** Both call procedures as plain
functions with no network. But `caller.categories.list()` hands you _data_,
while `trpc.blunders.byCategory.queryOptions({ category })` hands you _query
options_ — the same shape `useTRPC()` produces in the browser, and crucially
**the same cache key**. That alignment is the entire trick: the server fills an
entry the client is about to look for.

Use `caller` when a Server Component just wants a value. Use the proxy when a
Client Component's cache needs seeding.

> **Gotcha:** `cache()` is not optional. Drop it and `getQueryClient()` returns a
> fresh client each call — you would prefetch into one and dehydrate another,
> and ship an empty cache. It fails silently: the app still works, just with the
> loading state you were trying to remove.

Note this is also why Part 2's relative-URL warning never bites. Nothing here
goes over HTTP, so there is no URL to make absolute.

## 2. Let the cache dehydrate pending queries — `trpc/query-client.ts`

```ts
import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000 },
      dehydrate: {
        // By default only *settled* queries are serialised. Including pending
        // ones lets us start a query without awaiting it and stream the result.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}
```

## 3. Prefetch and wrap — `app/[category]/page.tsx`

```tsx
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { BlunderBrowser } from "./blunder-browser";
import { getQueryClient, trpc } from "@/trpc/server";

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.blunders.byCategory.queryOptions({ category }));

  return (
    <main>
      <h1>{category}</h1>
      <div style={{ display: "flex", gap: "3rem" }}>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <BlunderBrowser key={category} category={category} />
        </HydrationBoundary>
      </div>
    </main>
  );
}
```

`key={category}` is unaffected. The cache lives on the `QueryClient`, not on the
component, so remounting re-reads the same hydrated entry rather than refetching.

## What actually lands in the HTML

Measured on this app, `/blitz` (300 blunders, procedure limit 50):

|                       | rows in HTML | `Loading` in HTML | dehydrated entry |
| --------------------- | ------------ | ----------------- | ---------------- |
| Part 2 — client fetch | 0            | 1                 | no               |
| Part 2.5 — prefetch   | 50           | 0                 | yes              |

The serialised entry carries exactly the key from Part 2:

```
[["blunders","byCategory"],{"input":{"category":"blitz"},"type":"query"}]
```

That is why the browser finds it. Same procedure path, same input, same key.

One detail worth seeing, since `void` was used rather than `await`. What gets
serialised is not the rows but a reference to a streamed promise:

```
{"queryHash":"[[\"blunders\",\"byCategory\"]...", "promise":"$@11"}
```

React resolves it in a later chunk of the same response, and the server still
emits finished markup — `<ol aria-busy="false">` with all fifty rows. You get
streaming without giving up server-rendered content.

## `void` vs `await`

| form                                   | behaviour                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `void queryClient.prefetchQuery(...)`  | render proceeds immediately, the promise streams. Requires the `shouldDehydrateQuery` change above. |
| `await queryClient.prefetchQuery(...)` | page render blocks until the query resolves. Simpler, no pending-dehydration needed.                |

With one query the difference is small. With several, `void` lets them overlap
instead of queueing — start them all, await none.

> **Gotcha:** `void` here is deliberate, not sloppiness. It marks "I am starting
> this and intentionally not awaiting it." Without the keyword some lint configs
> flag the floating promise, and a reader cannot tell the omission was on
> purpose.

## Two ways to get nothing for your trouble

Both fail quietly — the app works, it is just slow again.

**Mismatched input.** The prefetch and the `useQuery` must produce the same key.
`queryOptions({ category })` on the server and `queryOptions({ category, limit: 50 })`
on the client are two different entries, so the client ignores your prefetch and
fetches anyway — while the HTML still carries the payload you paid to compute.

**`staleTime: 0`.** A hydrated entry that is already stale refetches on mount.
You would get server-rendered HTML and an immediate duplicate request. Prefetch
and `staleTime` are a pair; the value in Part 2 is what makes this worth doing.

## What this does not fix

`/` is still `○ Static`, and prefetching has nothing to say about it — that is
Next's own render cache, a different mechanism at a different layer. Still
tracked in Part 1.5 and BG-2.
