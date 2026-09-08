# Learning notes

Reference notes written while building this app. Aimed at a frontend-leaning engineer who wants to understand the data layer well enough to reason about it, not to specialise in it.

Each part follows the same shape: **the whole file**, then **the pieces** broken down, then **gotchas**. Type the files, read the breakdown, skim the gotchas until one bites you.

## Contents

- [Part 1 — tRPC](#part-1--trpc)
  - [The one idea](#the-one-idea)
  - [1. `apps/web/server/trpc.ts`](#1-appswebservertrpcts)
  - [2. `apps/web/server/router.ts`](#2-appswebserverrouterts)
  - [3. `apps/web/app/api/trpc/[trpc]/route.ts`](#3-appswebappapitrpctrpcroutets)
  - [4. `apps/web/trpc/client.ts`](#4-appswebtrpcclientts)
  - [It's just HTTP](#its-just-http)
  - [Validation runs both ways](#validation-runs-both-ways)
  - [Types flow to the client for free](#types-flow-to-the-client-for-free)
- [Part 1.5 — Server Components](#part-15--server-components)
  - [The one idea](#the-one-idea-1)
  - [The split](#the-split)
  - [Layouts persist across navigation](#layouts-persist-across-navigation)
  - [Static vs dynamic is invisible in the code](#static-vs-dynamic-is-invisible-in-the-code)
  - [The open problem → Part 2](#the-open-problem--part-2)
- [Part 2 — TanStack Query](#part-2--tanstack-query)
  - [The one idea](#the-one-idea-2)
  - [1. `apps/web/trpc/query-client.ts` — new file](#1-appswebtrpcquery-clientts--new-file)
  - [2. `apps/web/trpc/client.tsx`](#2-appswebtrpcclienttsx)
  - [3. `apps/web/app/layout.tsx`](#3-appswebapplayouttsx)
  - [4. `apps/web/app/[category]/blunder-browser.tsx`](#4-appswebappcategoryblunder-browsertsx)
  - [The race condition it deletes](#the-race-condition-it-deletes)
  - [`key` does the other half](#key-does-the-other-half)
  - [The query key is the cache identity](#the-query-key-is-the-cache-identity)
  - [`isPending` vs `isFetching`](#ispending-vs-isfetching)
- [Part 2.5 — Prefetch and Hydration](#part-25--prefetch-and-hydration)
  - [The one idea](#the-one-idea-3)
  - [1. `apps/web/trpc/server.tsx` — new file](#1-appswebtrpcservertsx--new-file)
  - [2. `apps/web/app/[category]/page.tsx`](#2-appswebappcategorypagetsx)
  - [`await`, not `void` — with `useQuery`](#await-not-void--with-usequery)
  - [Two ways to silently get nothing](#two-ways-to-silently-get-nothing)
- [Part 2.7 — Routing to a Blunder](#part-27--routing-to-a-blunder)
  - [The one idea](#the-one-idea-4)
  - [The shape](#the-shape)
  - [1. `apps/web/server/router.ts`](#1-appswebserverrouterts)
  - [2. `apps/web/app/[category]/analysis.tsx`](#2-appswebappcategoryanalysistsx)
  - [3. `apps/web/app/[category]/[blunderId]/page.tsx` — new file](#3-appswebappcategoryblunderidpagetsx--new-file)
  - [4. `apps/web/app/[category]/blunder-list.tsx` — new file](#4-appswebappcategoryblunder-listtsx--new-file)
  - [5. `apps/web/app/[category]/layout.tsx`](#5-appswebappcategorylayouttsx)
  - [6. `apps/web/app/[category]/page.tsx`](#6-appswebappcategorypagetsx)
  - [What died](#what-died)
- [Part 3 — Bucketing the List](#part-3--bucketing-the-list)
  - [The one idea](#the-one-idea-5)
  - [1. `apps/web/lib/blunders.ts` — new file](#1-appsweblibblundersts--new-file)
  - [2. `apps/web/server/router.ts`](#2-appswebserverrouterts-1)
  - [3. `apps/web/app/[category]/blunder-list.tsx`](#3-appswebappcategoryblunder-listtsx)
  - [Gotchas](#gotchas)
- [Part 3.5 — A Key That Isn't in the Data](#part-35--a-key-that-isnt-in-the-data)
  - [The one idea](#the-one-idea-6)
  - [1. `apps/web/lib/blunders.ts`](#1-appsweblibblundersts)
  - [2. `apps/web/app/[category]/blunder-list.tsx`](#2-appswebappcategoryblunder-listtsx)
  - [Gotchas](#gotchas-1)
- [Part 3.6 — An Extra Level for the Cube](#part-36--an-extra-level-for-the-cube)
  - [The one idea](#the-one-idea-7)
  - [1. `apps/web/lib/blunders.ts`](#1-appsweblibblundersts-1)
  - [2. `apps/web/app/[category]/blunder-list.tsx`](#2-appswebappcategoryblunder-listtsx-1)
  - [`flatMap`](#flatmap)
  - [Still open](#still-open)

---

# Part 1 — tRPC

## The one idea

tRPC has no codegen and no schema file. No `.proto`, no GraphQL SDL, no client to regenerate when the API changes.

Instead, **one TypeScript type crosses the client/server boundary by import.** You write server functions, export their _type_, and the client imports that type. The type is erased at build time, so nothing server-side ships to the browser — but the client gets full autocomplete and compile errors.

That's the whole trick. Everything else is plumbing.

| file | job |
| --- | --- |
| `server/trpc.ts` | init + context |
| `server/router.ts` | the API surface |
| `app/api/trpc/[trpc]/route.ts` | the HTTP adapter |
| `trpc/client.ts` | the browser client |

---

## 1. `apps/web/server/trpc.ts`

### The whole file

```ts
import { initTRPC } from "@trpc/server";
import { db } from "@/server/db";

export function createContext() {
  return { db };
}

type Context = ReturnType<typeof createContext>;

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

### The pieces

**The context** is built fresh per request and handed to every procedure. It is where request-scoped dependencies go — the database handle now, the logged-in user later. That per-request lifetime is the point: anything shared across requests is a leak waiting to happen.

**`initTRPC`** is called once per app and returns the builders: `router` groups procedures, `procedure` defines one.

---

## 2. `apps/web/server/router.ts`

### The shape

```ts
export const appRouter = router({
  blunders: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(25) }))
      .output(z.array(blunder))
      .query(({ ctx, input }) => {
        /* ...the SQL... */
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

### The pieces

Routers **nest**, which is how you get `trpc.blunders.list` rather than a flat pile of names. `.query()` is a read and `.mutation()` is a write — the practical difference is GET vs POST, and therefore what can be cached.

That last export line is the entire contract with the browser.

---

## 3. `apps/web/app/api/trpc/[trpc]/route.ts`

### The whole file

```ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/router";
import { createContext } from "@/server/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

### The pieces

Your whole API is **one** Next.js route. The `[trpc]` catch-all captures the procedure path from the URL; the adapter looks it up, runs it, serialises the result.

App Router requires named method exports — `export default handler` gives you a 405.

---

## 4. `apps/web/trpc/client.ts`

### The whole file

```ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server/router";

export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});
```

### The pieces

**`import type` is load-bearing.** It is erased at compile time, so no server code, no database driver and no filesystem paths reach the browser. A plain `import` drags all of it in — and, as Part 3 shows, usually fails the build rather than failing quietly.

`httpBatchLink` collects calls fired in the same tick into one HTTP request, so three components asking for data on mount is one round trip.

---

## It's just HTTP

The most useful thing to internalise, and the thing an interviewer is really checking when they ask how tRPC works:

```
GET /api/trpc/blunders.list?input={"limit":2}

{"result":{"data":[{"blunder_id":12069561,"kind":"checker", ... }]}}
```

Procedure path in the URL, input as a JSON query param, result under `result.data`. Batched calls look like `?batch=1&input={"0":{...}}` and return an array. Nothing magic is happening at the transport layer — it is a POST/GET API with a typed wrapper on both ends.

## Validation runs both ways

`.input()` and `.output()` are the same mechanism pointed in opposite directions.

**`.input(schema)`** validates at runtime and rejects bad input with a 400 — and at compile time it infers the type of `input` in your handler, so you never annotate it:

```
GET /api/trpc/blunders.list?input={"limit":9999}
→ {"error":{"message":"Too big: expected number to be <=200", ... }}
```

The reason this matters, and the actual interview answer: **TypeScript types vanish at runtime.** They protect you from nothing at a network boundary. Zod is the runtime half, and the type is inferred from the schema so the two cannot drift.

**`.output(schema)`** validates what you send back, catching a data source that quietly changed shape. You get a 500 on the server rather than a malformed object reaching a component and exploding as `undefined` three renders later. It costs a parse per response and turns a data problem into a hard failure, so it earns its place on boundaries you don't control.

## Types flow to the client for free

The payoff, and it is entirely a frontend concern:

```ts
type Blunder = inferRouterOutputs<AppRouter>["blunders"]["list"][number];
```

Your component derives its types **from the API itself** — no shared types package, no duplicated interface, nothing to keep in sync. Change the procedure and the component's types move with it, which is the property a hand-maintained `types.ts` never has. There is `inferRouterInputs` for the argument side.

# Part 1.5 — Server Components

## The one idea

The app has two ways to call the same procedures, and choosing between them is the main architectural decision in a Next.js app.

```ts
// trpc/client.ts — browser. Goes over HTTP.
export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});

// server/caller.ts — Server Components. No network at all.
export const caller = createCallerFactory(appRouter)(createContext);
```

`createCallerFactory` invokes procedures as **plain functions**. No fetch, no serialisation, no round trip — the query runs during render and its result is baked into the HTML.

```tsx
export async function CategoryNav() {
  const categories = await caller.categories.list();
  // ...
}
```

Server Components can be `async`. No `useEffect`, no loading state, no waterfall, and no JavaScript shipped for it.

`import "server-only"` at the top of `caller.ts` makes the build fail loudly if a Client Component ever imports it. Worth adding, because the failure it prevents — leaking the database handle into a client bundle — is otherwise silent.

## The split

| data | where | why |
| --- | --- | --- |
| Category list + counts | Server (RSC) | changes rarely, needed on first paint |
| Blunders for a category | Client | changes on every navigation |
| Which blunder is active | Client state | pure interaction, no fetch |

Slow-moving data server-side, interactive data client-side. A better starting point than "fetch everything on the client", and the reasoning an interviewer is looking for when they ask where a given fetch belongs.

## Layouts persist across navigation

`CategoryNav` lives in `app/layout.tsx`, not in the page. Next reuses a layout across navigations between its children, so clicking through categories does **not** re-run the category query. Put the nav in each page instead and it re-queries on every click.

## Static vs dynamic is invisible in the code

`next build` labels every route:

```
┌ ○ /                    ← Static: rendered once at BUILD time
├ ƒ /[category]          ← Dynamic: rendered per request
```

`○ Static` means the sidebar counts were computed **when the app was built** and frozen into the HTML — re-running the scraper won't change them until the next deploy. That is currently wrong for us and left visible on purpose. The fix is one line: `export const revalidate = 3600` for ISR, or `dynamic = "force-dynamic"` for always-fresh.

The trap worth remembering: a Server Component that reads a database looks identical whether it runs once at build time or on every request. Nothing in the component tells you which. The only signal is the `○` / `ƒ` in the build output.

## The open problem → Part 2

`blunder-browser.tsx` still fetches by hand:

```tsx
useEffect(() => {
  setBlunders(null);
  setActiveId(null);
  trpc.blunders.byCategory.query({ category }).then(setBlunders);
}, [category]);
```

It works, and it's deliberately explicit so the request stays visible. But: no error handling, no cleanup (navigate fast and a stale response overwrites a newer one), no caching, manual reset of two state slices on every change, and no way to invalidate or refetch.

Every one of those is what TanStack Query exists to solve.

# Part 2 — TanStack Query

## The one idea

`useState` + `useEffect` treats server data as if you own it. You don't. It is a **local replica of something that lives somewhere else and can change without telling you.**

TanStack Query is not a fetching library. It is a cache with a fetching policy. You never say "go fetch now". You declare _what this component needs_, under a key, and the cache decides whether the copy it already has is good enough. Deduplication, background refetch, retries and staleness all fall out of that one reframing.

```sh
pnpm --filter web add @tanstack/react-query @trpc/tanstack-react-query
```

Use `@trpc/tanstack-react-query`, not the older `@trpc/react-query`. The old one wraps every TanStack hook so tRPC sits permanently in the middle; the new one wraps nothing — `queryOptions()` returns a plain options object that composes with `useQuery`, `useSuspenseQuery`, `useQueries` and `setQueryData` alike. If you see `.useQuery()` hanging off the tRPC object, you're reading the old API and it won't work here.

| file | job |
| --- | --- |
| `trpc/query-client.ts` | new — the cache, configured |
| `trpc/client.tsx` | provider + `useTRPC` (was `client.ts`) |
| `app/layout.tsx` | mount the provider |
| `app/[category]/blunder-browser.tsx` | the refactor — the actual lesson |

---

## 1. `apps/web/trpc/query-client.ts` — new file

### The whole file

```ts
import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}
```

### The pieces

**`staleTime` is the one option to understand.** It answers: _how long may I serve this without asking again?_ The default is `0`, which means every new mount refetches immediately — technically correct, and the reason people conclude the cache "isn't working".

Don't confuse it with `gcTime` (default 5 minutes), which answers a different question: _how long do I keep this after nothing is rendering it?_ `staleTime` governs refetching, `gcTime` governs eviction.

**Why a factory and not a module-level `new QueryClient()`.** This module is evaluated on the server too, where a singleton would be shared across every concurrent request — one visitor's cache serving another's response. A factory gives one client per server request, and one for the browser tab.

---

## 2. `apps/web/trpc/client.tsx`

Replaces `trpc/client.ts`. It gains JSX, so it needs the new extension: `git mv apps/web/trpc/client.ts apps/web/trpc/client.tsx`.

### The whole file

```tsx
"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";

import type { AppRouter } from "../server/router";
import { makeQueryClient } from "./query-client";

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
  // Browser: one cache for the tab's lifetime. Re-making it here would
  // silently throw away everything cached so far.
  return (browserQueryClient ??= makeQueryClient());
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    return createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc" })],
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

### The pieces

`useTRPC()` returns an object shaped like the router, where every procedure exposes `queryOptions`, `queryKey`, `queryFilter` — builders, not hooks. `useState`'s initialiser runs once per mount, so the client is built once rather than rebuilt on every render.

Both providers are required, and `TRPCProvider` needs the _same_ `queryClient` instance as `QueryClientProvider`. Miss the outer one and you get a runtime `No QueryClient set` on first render.

---

## 3. `apps/web/app/layout.tsx`

### The whole file

```tsx
import { CategoryNav } from "./category-nav";
import { TRPCReactProvider } from "@/trpc/client";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ display: "flex", gap: "3rem" }}>
        <TRPCReactProvider>
          <CategoryNav />
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
```

### The pieces

**A `"use client"` provider does not make its children client components.** `layout.tsx` is a Server Component, so `<CategoryNav />` is evaluated _there_ and its finished output is passed to the provider as `children`. The provider renders a slot it never owns.

This only holds because the components arrive **as children**. If `TRPCReactProvider` imported `CategoryNav` itself, that import would drag the database handle across the boundary and `server-only` would fail the build. Composition is what keeps the boundary honest.

---

## 4. `apps/web/app/[category]/blunder-browser.tsx`

The whole point of Part 2. What leaves:

```tsx
const [blunders, setBlunders] = useState<Blunder[] | null>(null);

useEffect(() => {
  setBlunders(null);
  setActiveId(null);
  trpc.blunders.byCategory.query({ category }).then(setBlunders);
}, [category]);
```

### The whole file

`BlunderDetail` at the bottom is unchanged presentational markup, elided here.

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AppRouter } from "@/server/router";
import { useTRPC } from "@/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";

type Blunder = inferRouterOutputs<AppRouter>["blunders"]["byCategory"][number];

export function BlunderBrowser({ category }: { category: string }) {
  const trpc = useTRPC();
  const [activeId, setActiveId] = useState<number | null>(null);

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.length === 0) return <p>No blunders in this category.</p>;

  const active = data.find((b) => b.blunder_id === activeId) ?? null;

  return (
    <>
      <ol aria-busy={isFetching}>
        {data.map((blunder) => (
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

### The pieces

**Both guards are required, not one.** `useQuery` returns a discriminated union — pending, error and success are distinct shapes, and only success carries a non-`undefined` `data`:

```tsx
if (isPending) return <p>Loading...</p>;
data.length; // ✗ possibly 'undefined' — the error variant
```

Guard both and `data` narrows to `Blunder[]`, with no `?.` anywhere below. The order of the two checks doesn't matter, and destructuring is fine — TypeScript narrows destructured discriminated unions as long as the bindings are `const`.

**`const trpc = useTRPC()`** shadows the name the old import used. Same spelling, completely different thing: Part 1's `trpc` executed calls, this one only describes them.

---

## The race condition it deletes

The one people get wrong by hand. The old code had no guard: navigate from A to B fast enough and A's slower response lands after B's, calling `setBlunders` with the wrong list. Nothing in that code is obviously broken, which is why it survives code review.

Query cannot express that bug. Responses are filed under the key they were *requested* with, and a component reads only the key it asked for. A late response for A writes to A's entry while the component is reading B's.

## `key` does the other half

The old `useEffect` was quietly doing **two** jobs: refetching the data, and resetting `activeId` so a selection didn't survive into a different category. Query takes the first. It has no opinion about the second.

Left alone that is a real bug: a blunder can belong to several categories, so a stale `activeId` can still match a row in the category you just navigated to, and the detail pane shows a selection you never made.

The React answer is not another effect. It is `key`, in `app/[category]/page.tsx`:

```tsx
<BlunderBrowser key={category} category={category} />
```

A changed `key` remounts the component, and remounting resets its state. State that is only meaningful for one value of a prop should be keyed on that prop. Reaching for `useEffect` to reset state is the anti-pattern this replaces.

## The query key is the cache identity

`queryOptions({ category })` builds a key from the procedure path and the input:

```
[["blunders", "byCategory"], { input: { category: "blitz" }, type: "query" }]
```

Path plus input, which is why `blitz` and `middle_game` are separate entries and switching between them is instant on the second visit. It is also what makes invalidation addressable:

```ts
queryClient.invalidateQueries(trpc.blunders.byCategory.queryFilter({ category }));
```

## `isPending` vs `isFetching`

| flag | means |
| --- | --- |
| `isPending` | no data in cache yet — nothing to render |
| `isFetching` | a request is in flight right now, including a background refresh |
| `isLoading` | `isPending && isFetching` — the first load specifically |

A background refetch over cached data is `isFetching: true` with `isPending: false`. Render the stale data and a subtle indicator; don't throw the user back to "Loading...". That distinction is most of what makes an app built on this feel quick.

Note v4 called the first-load flag `isLoading` and v5 renamed it to `isPending`, so v4 answers will mislead you.

# Part 2.5 — Prefetch and Hydration

## The one idea

Part 2 fixed how the browser fetches. It did not change **when**. Ask the server for `/blitz` and the rows are not in the HTML: the document arrives, the bundle downloads, React hydrates, `useQuery` fires, a request goes to `/api/trpc`, and _then_ SQLite is read. Every step after the first is avoidable — the server had the database open when it wrote that HTML and sent "Loading..." instead.

Same observation as Part 1.5, pointed at a harder case. `CategoryNav` solved it by not being a Client Component at all. `BlunderBrowser` can't do that; it owns `activeId` and has to stay interactive.

So: run the query on the server during render, put the result in a query cache, serialise that cache into the HTML, and let the browser's `QueryClient` adopt it on startup. `useQuery` then finds its entry already populated and never enters `isPending`.

---

## 1. `apps/web/trpc/server.tsx` — new file

### The whole file

```tsx
import "server-only";

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";

import { appRouter } from "@/server/router";
import { createContext } from "@/server/trpc";

import { makeQueryClient } from "./query-client";

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

### The pieces

**How this differs from `caller`.** Both call procedures as plain functions with no network. But `caller.categories.list()` hands you _data_, while `trpc.blunders.byCategory.queryOptions({ category })` hands you _query options_ — the same shape `useTRPC()` produces in the browser, and crucially **the same cache key**. That alignment is the whole trick: the server fills an entry the client is about to look for.

Use `caller` when a Server Component just wants a value. Use the proxy when a Client Component's cache needs seeding.

**`cache()` is not optional.** Drop it and `getQueryClient()` returns a fresh client each call — you'd prefetch into one and dehydrate another, shipping an empty cache. It fails silently: the app still works, just with the loading state you were trying to remove.

---

## 2. `apps/web/app/[category]/page.tsx`

### The whole file

```tsx
import { dehydrate, HydrationBoundary, noop } from "@tanstack/react-query";

import { getQueryClient, trpc } from "@/trpc/server";
import { BlunderBrowser } from "./blunder-browser";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;

  const queryClient = getQueryClient();
  await queryClient.query(trpc.blunders.byCategory.queryOptions({ category })).catch(noop);

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

### The pieces

**`blunder-browser.tsx` does not change at all.** That is the appeal of this version: the component written in Part 2 is already correct, it just stops ever seeing `isPending`.

**`key={category}` is unaffected.** The cache lives on the `QueryClient`, not on the component, so remounting re-reads the same hydrated entry rather than refetching.

**`.catch(noop)` is not decoration.** `query()` returns `Promise<TData>` and rejects; without the catch, a database error becomes an unhandled rejection during server render instead of degrading to a client-side fetch. (`prefetchQuery` swallowed errors for you and is deprecated.)

## `await`, not `void` — with `useQuery`

You'll see `void prefetchQuery(...)` in most write-ups, reasoning that not awaiting lets the query stream instead of blocking render. That's true, and it only pays off **if something suspends**. `useQuery` does not suspend, so pairing `void` with it means the server renders the loading state and gives up before the data arrives — you pay to run the query and still ship a spinner.

Measured on this app: `await` + `useQuery` puts all 50 rows in the HTML; `void` + `useQuery` puts in 0. `void` is not a free optimisation — it is half of a different design, and the other half is `useSuspenseQuery` under a `<Suspense>` boundary. That pairing is worth knowing about for a page firing several independent queries you want overlapping rather than queued; with one query there is no waterfall to flatten, so `await` is right here.

## Two ways to silently get nothing

Both leave the app working and slow, and neither shows up in `check-types`, `lint` or `next build`.

**Mismatched input.** The prefetch and the `useQuery` must produce the same key. `queryOptions({ category })` on the server and `queryOptions({ category, limit: 50 })` on the client are two different entries, so the client ignores your prefetch and fetches anyway — while the HTML still carries the payload you paid to compute.

**`staleTime: 0`.** A hydrated entry that's already stale refetches on mount: server-rendered HTML plus an immediate duplicate request. Prefetch and `staleTime` are a pair.

Verify by curling the served page, not by trusting a green build.

# Part 2.7 — Routing to a Blunder

## The one idea

Part 2 kept the open blunder in `useState`. That made it **client** state, and client state can only be filled in after the JavaScript runs — which is why opening a blunder flashed "Loading analysis...".

Move the selection into the URL and it stops being client state. A route param is something the **server** already knows, so the detail can be fetched during render and arrive in the HTML. The flash has nothing left to flash. And you get the thing state never could: a blunder you can link to.

## The shape

Parts 2–2.5 built one component, `blunder-browser.tsx`, holding both panes. It splits along the seam the URL just created:

```
app/[category]/
  layout.tsx              list + shell, persists across blunders
  page.tsx                "Select a blunder."
  blunder-list.tsx        client — links, no state
  analysis.tsx            server — the panel (moved, near-unchanged)
  [blunderId]/page.tsx    server — fetches one detail
```

The list moves to a **layout**, not a page. A layout renders once per category and is reused while only `children` swaps, so clicking through blunders doesn't re-run the list query or remount the list. Put it in `page.tsx` and every click re-renders it.

---

## 1. `apps/web/server/router.ts`

`blunder_id` is unique across categories, so `/race/17640686` would happily render a blitz blunder inside the race list. The category is in the URL, so it belongs in the input — and the join is what makes a wrong pair return `null` instead of the wrong position.

### The change

```ts
detail: publicProcedure
  .input(z.object({ category: z.string(), blunder_id: z.number().int() }))
  .output(blunderDetail.nullable())
  .query(({ ctx, input }) => {
    const row = ctx.db
      .prepare(
        `SELECT ${DETAIL_COLUMNS}
         FROM blunders b
         JOIN blunder_categories bc ON bc.blunder_id = b.blunder_id
         WHERE b.blunder_id = ? AND bc.category = ?`,
      )
      .get(input.blunder_id, input.category);

    if (!row) return null;

    // ...the rest of the procedure is unchanged.
```

`DETAIL_COLUMNS` also needs `b.` prefixes now that a second table is in scope.

---

## 2. `apps/web/app/[category]/analysis.tsx`

Move `Chances`, `Side`, `CubeEquities`, `Plays`, the `percent`/`equity` helpers and the style objects across from `blunder-browser.tsx` **unchanged**. It's a 240-line file that is almost entirely markup, so the only things worth noting are structural.

There is no `"use client"`: nothing here has state or handlers, so it renders on the server and ships no JavaScript. `BlunderPanel` and `Analysis` **merge** into one exported `BlunderAnalysis` — they were two only so the summary could render while the analysis loaded, and nothing loads now.

---

## 3. `apps/web/app/[category]/[blunderId]/page.tsx` — new file

### The whole file

```tsx
import { notFound } from "next/navigation";
import { caller } from "@/server/caller";
import { BlunderAnalysis } from "../analysis";

interface BlunderPageProps {
  params: Promise<{ category: string; blunderId: string }>;
}

export default async function BlunderPage({ params }: BlunderPageProps) {
  const { category, blunderId } = await params;

  const blunder_id = Number(blunderId);
  if (!Number.isInteger(blunder_id)) notFound();

  const detail = await caller.blunders.detail({ category, blunder_id });
  if (!detail) notFound();

  return <BlunderAnalysis detail={detail} />;
}
```

### The pieces

The whole point of the exercise, and it's nine lines.

**`caller`, not `useQuery`.** There is no client state here, so there's nothing for a query to cache and no hook to call. Direct function call, no HTTP, straight into the HTML.

**Validate the param.** `blunderId` is whatever was in the URL bar, so it's a string that may not be a number at all — `Number("12abc")` is `NaN` and `Number("")` is `0`. Anything reaching a query from a URL is untrusted input.

**`notFound()` returns `never`**, so TypeScript narrows `detail` to non-null after the guard. You don't need `detail!` and shouldn't write it.

---

## 4. `apps/web/app/[category]/blunder-list.tsx` — new file

### The whole file

```tsx
"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";

export function BlunderList({ category }: { category: string }) {
  const trpc = useTRPC();
  const selected = useSelectedLayoutSegment();

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.length === 0) return <p>No blunders in this category.</p>;

  return (
    <ol aria-busy={isFetching}>
      {data.map((blunder) => (
        <li key={blunder.blunder_id}>
          <Link
            href={`/${category}/${blunder.blunder_id}`}
            aria-current={String(blunder.blunder_id) === selected ? "page" : undefined}
          >
            {blunder.kind} {blunder.error_magnitude.toFixed(3)}
          </Link>
        </li>
      ))}
    </ol>
  );
}
```

### The pieces

The URL is the selection now, so there's no `useState` to keep in sync. Inside `[category]/layout.tsx`, `useSelectedLayoutSegment()` is the `[blunderId]` segment below it, or `null` on the index route.

**It returns a string.** URL segments have no types, so `blunder.blunder_id === selected` is always false and TypeScript won't stop you — comparing `number` to `string | null` is allowed. Hence `String(...)`.

---

## 5. `apps/web/app/[category]/layout.tsx`

Almost exactly the old `page.tsx`, with `{children}` added beside the list.

### The whole file

```tsx
import { dehydrate, HydrationBoundary, noop } from "@tanstack/react-query";
import { getQueryClient, trpc } from "@/trpc/server";
import { BlunderList } from "./blunder-list";

interface CategoryLayoutProps {
  params: Promise<{ category: string }>;
  children: React.ReactNode;
}

export default async function CategoryLayout({ params, children }: CategoryLayoutProps) {
  const { category } = await params;

  const queryClient = getQueryClient();
  await queryClient.query(trpc.blunders.byCategory.queryOptions({ category })).catch(noop);

  return (
    <main>
      <h1>{category}</h1>
      <div style={{ display: "flex", gap: "3rem" }}>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <BlunderList category={category} />
        </HydrationBoundary>
        {children}
      </div>
    </main>
  );
}
```

### The pieces

The Part 2.5 prefetch is untouched and still earns its keep: the list is still a client component, and the rows are still in the HTML on first load.

The `key={category}` from Part 2 is gone. It existed to reset `activeId` when you switched categories, and there is no `activeId` any more.

---

## 6. `apps/web/app/[category]/page.tsx`

### The whole file

```tsx
export default function CategoryIndexPage() {
  return <p>Select a blunder.</p>;
}
```

Then delete `blunder-browser.tsx`. Nothing imports it now.

---

## What died

Worth noticing how much a URL replaced:

| gone | because |
| --- | --- |
| `useState<number \| null>` | the URL holds the selection |
| the `blunders.detail` `useQuery` | the server fetches it |
| `isPending` / `error` on the detail | nothing is pending client-side |
| the summary-then-analysis split | both arrive together |
| `key={category}` | no client state left to reset |
| `"use client"` on the whole panel | no state, no handlers |

The detail pane costs about 1.5 KB gzipped on the wire, and a route only ever renders the one position you opened — which is why the payload argument for keeping `detail` out of the list query stopped mattering the moment it became a URL.

Notice which mechanism did the work. Part 2.5 made the _list_ server-rendered by prefetching into the cache. This part made the _detail_ server-rendered by deleting the query.

> The cheapest query is the one you removed. Look at what is holding the state before reaching for a faster way to fetch it.

The list keeps its query. It is still interactive, and filtering and sorting are going to live there.

# Part 3 — Bucketing the List

## The one idea

Every row already knows what it is. `kind` is `checker`, `cube` or `both`, and the list has been printing it on all fifty lines:

```tsx
{kind} {error_magnitude.toFixed(3)}
```

Printing a value on every row is what you do when you have not grouped by it.

This part is array work: one pass to bucket the rows, then render the buckets.

Three files change:

| file | why |
| --- | --- |
| `apps/web/lib/blunders.ts` | new — the bucket names |
| `apps/web/server/router.ts` | `kind` gets a real type, and the row type is exported |
| `apps/web/app/[category]/blunder-list.tsx` | the grouping and the render |

---

## 1. `apps/web/lib/blunders.ts` — new file

### The whole file

```ts
export const KINDS = ["checker", "cube", "both"] as const;

export type BlunderKind = (typeof KINDS)[number];
```

### The pieces

`KINDS` is the three bucket names **in the order they should appear on screen**. That second job matters — the render walks this array, so this is where display order is decided.

`as const` freezes it into a literal tuple rather than `string[]`, which is what makes `BlunderKind` the union `"checker" | "cube" | "both"` instead of `string`.

### Why its own file

Not `server/router.ts`, even though that is where the shape is defined. The list is a client component, and importing a *value* from the router drags `server/trpc.ts` and then `server/db.ts` behind it, at which point the build dies trying to put `node:sqlite` in the browser bundle. Types are fine — they are erased — which is why `import type { Blunder }` below is safe and `import { KINDS }` from the same file would not be.

---

## 2. `apps/web/server/router.ts`

An existing file, so only the changed lines. Add the import:

```ts
import { KINDS } from "@/lib/blunders";
```

Change `kind` in **both** `blunder` and `blunderDetail`:

```ts
  kind: z.enum(KINDS),   // was z.string()
```

And export the row type, which the list needs:

```ts
export type Blunder = z.infer<typeof blunder>;   // was: type Blunder = …
```

`z.enum` buys two things. `.output()` now rejects a row whose `kind` is not one of the three, so a scraper change fails at the boundary instead of rendering an invisible bucket. And every bucket key downstream is checked — `byKind.cubes` is an error rather than a silent `undefined`.

---

## 3. `apps/web/app/[category]/blunder-list.tsx`

### The whole file

```tsx
"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { KINDS, type BlunderKind } from "@/lib/blunders";
import { useTRPC } from "@/trpc/client";

interface BlunderListProps {
  category: string;
}

const KIND_LABEL: Record<BlunderKind, string> = {
  checker: "Checker plays",
  cube: "Cube decisions",
  both: "Checker and cube",
};

export function BlunderList({ category }: BlunderListProps) {
  const trpc = useTRPC();

  const selected = useSelectedLayoutSegment();

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.length === 0) return <p>No blunders in this category.</p>;

  const byKind = Object.groupBy(data, (blunder) => blunder.kind);

  return (
    <div aria-busy={isFetching}>
      {KINDS.map((kind) => {
        const blunders = byKind[kind];
        if (!blunders) return null;

        return (
          <section key={kind}>
            <h2>
              {KIND_LABEL[kind]} <data value={blunders.length}>({blunders.length})</data>
            </h2>
            <ol>
              {blunders.map(({ blunder_id, error_magnitude }) => (
                <li key={blunder_id}>
                  <Link
                    href={`/${category}/${blunder_id}`}
                    aria-current={String(blunder_id) === selected ? "page" : undefined}
                  >
                    {error_magnitude.toFixed(3)}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
```

### The pieces

**The labels.**

```tsx
const KIND_LABEL: Record<BlunderKind, string> = {
  checker: "Checker plays",
  cube: "Cube decisions",
  both: "Checker and cube",
};
```

Outside the component, because it never changes. Add a fourth kind to `KINDS` and this stops compiling until it has a heading.

**The grouping.** One line, and the only new API in this part:

```tsx
const byKind = Object.groupBy(data, (blunder) => blunder.kind);
```

One pass over the array, a callback that returns a key, an object of arrays back:

```js
{
  checker: [ /* 37 rows */ ],
  cube:    [ /* 11 rows */ ],
  both:    [ /*  2 rows */ ],
}
```

Rows keep the order they arrived in, which is already magnitude descending. Grouping does not shuffle anything.

**The outer loop.** Over `KINDS`, never over `Object.keys(byKind)` — see the gotchas:

```tsx
{KINDS.map((kind) => {
  const blunders = byKind[kind];
  if (!blunders) return null;
  // …
})}
```

**The rows** are unchanged from Part 2.7 except that `{kind}` is gone from the line. The heading says it once per group, which is the actual payoff — grouping did not just reorganise the list, it deleted fifty repetitions.

---

## Gotchas

### It only creates keys it actually saw

A category with no cube blunders has no `cube` key — not an empty array:

```js
Object.groupBy([{ kind: "checker" }], (r) => r.kind);
// { checker: [ … ] }   <- no `cube`, no `both`
```

`/close_out` is exactly this: seven checker blunders and nothing else. Reading `.length` off the missing bucket is a `TypeError`, in a category you did not happen to open while developing. Hence `if (!blunders) return null`.

### Key order follows first occurrence, not your list

The rows arrive sorted by magnitude, so the first bucket is whatever the single worst blunder happened to be:

```js
const rows = [
  { kind: "cube", m: 0.9 },
  { kind: "checker", m: 0.5 },
  { kind: "both", m: 0.2 },
];
Object.keys(Object.groupBy(rows, (r) => r.kind));
// -> ["cube", "checker", "both"]
```

Change the data and the headings reorder themselves. Mapping over `KINDS` — a list you wrote down — makes the order stable and makes it yours.

### The older way

`Object.groupBy` landed in 2024. For the decade before it this was a `reduce`, and it is still what most code you read will look like:

```ts
const byKind = data.reduce<Record<string, Blunder[]>>((acc, blunder) => {
  const key = blunder.kind;
  acc[key] ??= [];
  acc[key].push(blunder);
  return acc;
}, {});
```

Worth being able to write, because it makes the machinery obvious: an accumulator, a key, a push. The `??= []` is the whole trick — the first row for any key has no array to push onto yet, and forgetting it is the classic crash.

| | `Object.groupBy` | `reduce` |
| --- | --- | --- |
| missing bucket | absent, and you are made to check | absent, and nothing warns you |
| first row of a key | handled | `acc[key] ??= []` or it throws |
| reads as | "group these by kind" | "fold these into an object" |

`reduce` is still right the moment the fold is not a grouping — a sum, a max, a lookup keyed by id. Grouping specifically now has a better verb.

### Where the grouping runs

In the render body, so it runs on every render. For fifty rows that is a few microseconds, and leaving it there is the right default — derived values belong in render until something measures otherwise. `useMemo` is the next step if it ever matters, and TanStack Query's `select` the one after that. Both are Part 4 material.


# Part 3.5 — A Key That Isn't in the Data

## The one idea

Part 3 grouped by a column. This part groups by something no column holds.

The obvious second axis is severity, and the table appears to have it:

```sql
SELECT error_severity, COUNT(*) FROM blunders GROUP BY error_severity;
-- blunder | 1380
```

One value, 1380 rows. The column is dead — the scraper only collected positions already classified as blunders, so the field records the filter, not a grade.

What does vary is `error_magnitude`, the equity actually thrown away:

| band          | rows |
| ------------- | ---: |
| below 0.1     |  344 |
| 0.1 to 0.2    |  734 |
| 0.2 to 0.4    |  234 |
| 0.4 and above |   68 |

That is a real distribution. The key has to be computed from it.

---

## 1. `apps/web/lib/blunders.ts`

### The whole file

```ts
export const KINDS = ["checker", "cube", "both"] as const;

export type BlunderKind = (typeof KINDS)[number];

export const SEVERITY_BANDS = [
  { id: "catastrophic", label: "Catastrophic", min: 0.4 },
  { id: "severe", label: "Severe", min: 0.2 },
  { id: "moderate", label: "Moderate", min: 0.1 },
  { id: "mild", label: "Mild", min: 0 },
] as const;

export type Severity = (typeof SEVERITY_BANDS)[number]["id"];

export function severityOf(errorMagnitude: number): Severity {
  const band = SEVERITY_BANDS.find(({ min }) => errorMagnitude >= min);
  return band?.id ?? "mild";
}
```

### The pieces

**The table.** A sorted array plus `find` beats an `if/else` ladder because the bands become *data*: they can be rendered, counted, reordered, or eventually driven by a control. The same array classifies the rows and titles the headings.

**The lookup.**

```ts
const band = SEVERITY_BANDS.find(({ min }) => errorMagnitude >= min);
return band?.id ?? "mild";
```

`find` returns `undefined` when nothing matches. That cannot happen here — every magnitude clears the `min: 0` band — but it has to be handled anyway, so the fallback is `"mild"`, which is also the right answer if it ever did.

---

## 2. `apps/web/app/[category]/blunder-list.tsx`

### The whole file

```tsx
"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { KINDS, SEVERITY_BANDS, severityOf, type BlunderKind } from "@/lib/blunders";
import type { Blunder } from "@/server/router";
import { useTRPC } from "@/trpc/client";

interface BlunderListProps {
  category: string;
}

const KIND_LABEL: Record<BlunderKind, string> = {
  checker: "Checker plays",
  cube: "Cube decisions",
  both: "Checker and cube",
};

export function BlunderList({ category }: BlunderListProps) {
  const trpc = useTRPC();

  const selected = useSelectedLayoutSegment();

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.length === 0) return <p>No blunders in this category.</p>;

  const byKind = Object.groupBy(data, (blunder) => blunder.kind);

  return (
    <div aria-busy={isFetching}>
      {KINDS.map((kind) => {
        const blunders = byKind[kind];
        if (!blunders) return null;

        const bySeverity = Object.groupBy(blunders, (blunder) =>
          severityOf(blunder.error_magnitude),
        );

        return (
          <section key={kind}>
            <h2>
              {KIND_LABEL[kind]} <data value={blunders.length}>({blunders.length})</data>
            </h2>

            {SEVERITY_BANDS.map(({ id, label }) => {
              const banded = bySeverity[id];
              if (!banded) return null;

              return (
                <section key={id}>
                  <h3>
                    {label} <data value={banded.length}>({banded.length})</data>
                  </h3>
                  <BlunderLinks blunders={banded} category={category} selected={selected} />
                </section>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

interface BlunderLinksProps {
  blunders: Blunder[];
  category: string;
  selected: string | null;
}

function BlunderLinks({ blunders, category, selected }: BlunderLinksProps) {
  return (
    <ol>
      {blunders.map(({ blunder_id, error_magnitude, played_notation }) => (
        <li key={blunder_id}>
          <Link
            href={`/${category}/${blunder_id}`}
            aria-current={String(blunder_id) === selected ? "page" : undefined}
          >
            {played_notation ? `${played_notation} · ` : null}
            {error_magnitude.toFixed(3)}
          </Link>
        </li>
      ))}
    </ol>
  );
}
```

### The pieces

**The second grouping.** Nesting is just calling it again on each bucket:

```tsx
const bySeverity = Object.groupBy(blunders, (blunder) =>
  severityOf(blunder.error_magnitude),
);
```

The only difference from the first call is that this callback *computes* a key where the other *read* one. `Object.groupBy` does not care; it wants a string.

**The second loop** walks `SEVERITY_BANDS` for the same reason the first walks `KINDS` — declared order, stable headings, and the same `if (!banded) return null` guard because the same rule applies at every level.

**The extracted leaf.** At three levels of nesting the JSX stopped fitting on a line, so `BlunderLinks` came out. Note it is the *leaf* that was extracted, not the grouping: the grouping is the part worth reading in one place, the row markup was the part in the way. `selected` is threaded down as a prop rather than calling `useSelectedLayoutSegment` again — one call per list beats one per bucket, and it keeps the leaf a plain function of its props.

**The rows** now show `played_notation` when there is one, since checker rows have a move worth reading and cube rows do not.

---

## Gotchas

### Descending order is load-bearing

`find` returns the **first** match. With the bands high-to-low, the first band a magnitude clears is the tightest one that fits. Reverse the array and every non-negative magnitude matches `mild` immediately, so every blunder is mild. No error, no warning — just a wrong screen.

| magnitude | band         |
| --------- | ------------ |
| 0.0999    | mild         |
| 0.1000    | moderate     |
| 0.1999    | moderate     |
| 0.2000    | severe       |
| 0.3999    | severe       |
| 0.4000    | catastrophic |

Lower bound inclusive, upper bound exclusive, no gaps.

### The buckets describe the page, not the category

`/middle_game`, top fifty by magnitude:

```
Checker plays (37)
    Catastrophic (5)
    Severe (32)
Cube decisions (11)
    Doubled (5)
    Took (4)
    Passed (2)
Checker and cube (2)
    Severe (2)
```

No `Moderate`, no `Mild`, even though those are the two biggest bands across the database. Nothing is broken — `byCategory` is `ORDER BY error_magnitude DESC LIMIT 50`, so the page only holds the fifty worst positions, and in a busy category all fifty clear 0.2. `/close_out`, with seven rows total, does show `Moderate (4)` and `Mild (3)`.

That is the real limit of grouping on the client: you can only bucket what you asked for.


# Part 3.6 — An Extra Level for the Cube

## The one idea

Severity is the innermost question for every kind. A cube blunder still costs equity, and "how much" is still how you rank two of them.

What cube blunders have that checker blunders don't is a *side*. You were either offering the cube or being offered it, and those are different skills — misjudging a double is not the same mistake as misjudging a take. So the cube bucket gets an extra level **above** severity, not instead of it:

```
Cube decisions (11)
    Offering the cube (5)
        Catastrophic (1)
        Severe (4)
    Being offered the cube (6)
        Catastrophic (3)
        Severe (3)
```

The four `cube_action` values collapse into those two sides:

| `cube_action` | side |
| --- | --- |
| `double_requested` | offering |
| `dice_rolled` | offering |
| `double_accepted` | receiving |
| `double_rejected` | receiving |

---

## 1. `apps/web/lib/blunders.ts`

### The addition

```ts
/** The two sides of a cube decision, in the order the list shows them. */
export const CUBE_DIRECTIONS = [
  { id: "offer", label: "Offering the cube" },
  { id: "receive", label: "Being offered the cube" },
] as const;

export type CubeDirection = (typeof CUBE_DIRECTIONS)[number]["id"];

/** Which side of the cube the player was on. */
export function cubeDirection(action: BlunderCubeAction): CubeDirection {
  if (action === "double_accepted" || action === "double_rejected") return "receive";
  return "offer";
}
```

### The pieces

`cubeDirection` computes the key; `CUBE_DIRECTIONS` is the list you render from. Every grouping needs both halves and they must agree on the key space — group by one thing and render from a list of something else, and every lookup silently returns `undefined`.

---

## 2. `apps/web/app/[category]/blunder-list.tsx`

### The whole file

```tsx
"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  CUBE_DIRECTIONS,
  KINDS,
  SEVERITY_BANDS,
  cubeDirection,
  severityOf,
  type BlunderKind,
} from "@/lib/blunders";
import type { Blunder } from "@/server/router";
import { useTRPC } from "@/trpc/client";

interface BlunderListProps {
  category: string;
}

const KIND_LABELS: Record<BlunderKind, string> = {
  checker: "Checker plays",
  cube: "Cube decisions",
  both: "Both checker and cube",
};

export function BlunderList({ category }: BlunderListProps) {
  const trpc = useTRPC();

  const selected = useSelectedLayoutSegment();

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.length === 0) return <p>No blunders in this category.</p>;

  const byKind = Object.groupBy(data, (blunder) => blunder.kind);

  return (
    <div aria-busy={isFetching}>
      {KINDS.map((kind) => {
        const blunders = byKind[kind];
        if (!blunders) return null;

        return (
          <section key={kind}>
            <h2>
              {KIND_LABELS[kind]} <data value={blunders.length}>({blunders.length})</data>
            </h2>

            {groupsOf(kind, blunders).map((group) => (
              <Group
                key={group.id}
                group={group}
                category={category}
                selected={selected}
                depth={0}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

interface Group {
  id: string;
  label: string;
  blunders: Blunder[];
  groups: Group[];
}

/** Severity bands, the level every kind ends on. */
function bandsOf(blunders: Blunder[]): Group[] {
  const bySeverity = Object.groupBy(blunders, ({ error_magnitude }) => severityOf(error_magnitude));

  return SEVERITY_BANDS.flatMap(({ id, label }) => {
    const banded = bySeverity[id];
    return banded ? [{ id, label, blunders: banded, groups: [] }] : [];
  });
}

/**
 * Cube blunders get an extra level above severity: a cube error is still "how
 * much did this cost", but which side of the cube you were on is the thing that
 * makes two of them comparable.
 */
function groupsOf(kind: BlunderKind, blunders: Blunder[]): Group[] {
  if (kind !== "cube") return bandsOf(blunders);

  const byDirection = Object.groupBy(blunders, ({ cube_action }) => cubeDirection(cube_action));

  return CUBE_DIRECTIONS.flatMap(({ id, label }) => {
    const facing = byDirection[id];
    return facing ? [{ id, label, blunders: facing, groups: bandsOf(facing) }] : [];
  });
}

interface GroupProps {
  group: Group;
  category: string;
  selected: string | null;
  depth: number;
}

/** One bucket. Renders its rows, or its child buckets if it has any. */
function Group({ group, category, selected, depth }: GroupProps) {
  const Heading = depth === 0 ? "h3" : "h4";

  return (
    <section>
      <Heading>
        {group.label} <data value={group.blunders.length}>({group.blunders.length})</data>
      </Heading>

      {group.groups.length > 0 ? (
        group.groups.map((child) => (
          <Group
            key={child.id}
            group={child}
            category={category}
            selected={selected}
            depth={depth + 1}
          />
        ))
      ) : (
        <BlunderLinks blunders={group.blunders} category={category} selected={selected} />
      )}
    </section>
  );
}

interface BlunderLinksProps {
  blunders: Blunder[];
  category: string;
  selected: string | null;
}

function BlunderLinks({ blunders, category, selected }: BlunderLinksProps) {
  return (
    <ol>
      {blunders.map(({ blunder_id, error_magnitude, played_notation }) => (
        <li key={blunder_id}>
          <Link
            href={`/${category}/${blunder_id}`}
            aria-current={String(blunder_id) === selected ? "page" : undefined}
          >
            [{error_magnitude.toFixed(3)}] {played_notation}
          </Link>
        </li>
      ))}
    </ol>
  );
}
```

### The pieces

**`bandsOf` is unchanged from Part 3.5**, just pulled into its own function so both paths can use it. Severity is where every kind ends up.

**`groupsOf` adds a level only for cube.** It groups by direction, then hands each direction's rows straight back to `bandsOf` as children.

**`Group` renders itself, then either its children or its rows.** One component covers both depths, so the third level cost no new markup. `depth` only picks the heading tag, keeping the outline `h2 → h3 → h4`.

---

## `flatMap`

The point of this part. `map` gives you exactly one output per input. `flatMap` runs `map`, then flattens the result **one level** — so each input can produce many outputs, one, or none.

```js
[1, 2, 3].map((n) => [n, n * 10]); // [[1, 10], [2, 20], [3, 30]]
[1, 2, 3].flatMap((n) => [n, n * 10]); // [1, 10, 2, 20, 3, 30]
```

That flattening is what makes the empty array useful. Return `[]` and the item contributes nothing:

```js
[1, 2, 3, 4].flatMap((n) => (n % 2 ? [n] : [])); // [1, 3]
```

So the callback answers "what should this item become?" with three legal answers: `[x]` to keep it, `[]` to drop it, `[a, b]` to expand it. That is filter and map in one pass:

```ts
return SEVERITY_BANDS.flatMap(({ id, label }) => {
  const banded = bySeverity[id];
  return banded ? [{ id, label, blunders: banded, groups: [] }] : [];
});
```

Read it as: *for each band, if the bucket exists produce one group, otherwise produce nothing.*

**It only flattens one level.** `[[1, [2]]].flatMap((x) => x)` gives `[1, [2]]`, not `[1, 2]`. If you need deeper that's `.flat(Infinity)` — and wanting it usually means the shape is wrong.

### Why not `.map().filter()`

The obvious alternative leaves you with a type you can't use:

```ts
SEVERITY_BANDS.map(({ id, label }) => ({ id, label, blunders: bySeverity[id] })).filter(
  (group) => group.blunders !== undefined,
); // blunders is still possibly undefined
```

`filter` narrows when the callback tests the value itself — `(x) => x !== undefined` — but not when it tests a *property* of the value. There is no way to say "the same object, but that field is definitely there now".

`flatMap` sidesteps it by building the object only in the branch that has the data. Nothing is left to narrow, and it is one pass instead of two.

## Still open

The list is the worst fifty in the category, so a category with 300 blunders shows a sixth of itself and the sidebar count never matches. That is Part 4.

Loosely, from here: **Part 4** pagination, **Part 5** simple filters, **Part 6** mutations — a scratchpad textarea for notes on a blunder, which needs writing back to the database.
