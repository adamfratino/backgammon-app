# Learning notes

Reference notes written while building this app. Aimed at a frontend-leaning engineer who wants to understand the data layer well enough to reason about it, not to specialise in it.

Each part follows the same shape: **the whole file**, then **the pieces** broken down, then **gotchas**. Type the files, read the breakdown, skim the gotchas until one bites you.

Running it in a fresh git worktree needs `apps/web/.env.local` with `BLUNDERS_DB_PATH` pointing at the scraped database in the main checkout. The file is gitignored and exists in exactly one place, so without it every page throws while SQLite tries to open a file that isn't there — which reads like broken code rather than a missing database.

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
  - [1. `apps/web/lib/constants.ts` — new file](#1-appsweblibconstantsts--new-file)
  - [2. `apps/web/server/router.ts`](#2-appswebserverrouterts-1)
  - [3. `apps/web/app/[category]/blunder-list.tsx`](#3-appswebappcategoryblunder-listtsx)
  - [Gotchas](#gotchas)
- [Part 3.5 — A Key That Isn't in the Data](#part-35--a-key-that-isnt-in-the-data)
  - [The one idea](#the-one-idea-6)
  - [1. `apps/web/lib/constants.ts`](#1-appsweblibconstantsts)
  - [2. `apps/web/app/[category]/blunder-list.tsx`](#2-appswebappcategoryblunder-listtsx)
  - [Gotchas](#gotchas-1)
- [Part 3.6 — An Extra Level for the Cube](#part-36--an-extra-level-for-the-cube)
  - [The one idea](#the-one-idea-7)
  - [1. `apps/web/lib/constants.ts`](#1-appsweblibconstantsts-1)
  - [2. `apps/web/app/[category]/blunder-list.tsx`](#2-appswebappcategoryblunder-listtsx-1)
  - [`flatMap`](#flatmap)
  - [Still open](#still-open)
- [Part 4 — Pagination](#part-4--pagination)
  - [The one idea](#the-one-idea-8)
  - [1. `apps/web/lib/constants.ts`](#1-appsweblibconstantsts-2)
  - [2. `apps/web/server/router.ts`](#2-appswebserverrouterts-2)
  - [3. `apps/web/app/[category]/blunder-list.tsx`](#3-appswebappcategoryblunder-listtsx-1)
  - [4. `apps/web/proxy.ts` — new file](#4-appswebproxyts--new-file)
  - [5. `apps/web/app/[category]/layout.tsx`](#5-appswebappcategorylayouttsx-1)
  - [Gotchas](#gotchas-2)
- [Part 4.5 — Keeping the Old Page On Screen](#part-45--keeping-the-old-page-on-screen)
  - [The one idea](#the-one-idea-9)
  - [`apps/web/app/[category]/blunder-list.tsx`](#appswebappcategoryblunder-listtsx)
  - [Gotchas](#gotchas-3)
- [Part 4.6 — Prefetching the Next Page](#part-46--prefetching-the-next-page)
  - [The one idea](#the-one-idea-10)
  - [`apps/web/app/[category]/blunder-list.tsx`](#appswebappcategoryblunder-listtsx-1)
  - [Gotchas](#gotchas-4)
  - [Still open](#still-open-1)
- [Part 5 — Filters](#part-5--filters)
  - [The one idea](#the-one-idea-11)
  - [1. `apps/web/lib/constants.ts`](#1-appsweblibconstantsts)
  - [2. `apps/web/app/[category]/layout.tsx`](#2-appswebappcategorylayouttsx)
  - [3. `apps/web/app/[category]/blunder-list.tsx`](#3-appswebappcategoryblunder-listtsx-2)
  - [Gotchas](#gotchas-5)
  - [Still open](#still-open-2)
- [Part 5.5 — The Filter UI](#part-55--the-filter-ui)
  - [The one idea](#the-one-idea-12)
  - [1. `apps/web/lib/constants.ts`](#1-appsweblibconstantsts-4)
  - [2. `apps/web/app/[category]/blunder-filters.tsx` — new file](#2-appswebappcategoryblunder-filterstsx--new-file)
  - [3. `apps/web/app/[category]/layout.tsx`](#3-appswebappcategorylayouttsx)
  - [4. `apps/web/app/[category]/subcomponents/blunder-list-pagination.tsx`](#4-appswebappcategorysubcomponentsblunder-list-paginationtsx)
  - [5. `blunder-list-group.tsx` and `blunder-list-links.tsx`](#5-blunder-list-grouptsx-and-blunder-list-linkstsx)
  - [6. `apps/web/app/[category]/blunder-list.tsx`](#6-appswebappcategoryblunder-listtsx)
  - [Gotchas](#gotchas-6)
  - [Still open](#still-open-3)

---

# Part 1 — tRPC

## The one idea

tRPC has no codegen and no schema file. No `.proto`, no GraphQL SDL, no client to regenerate when the API changes.

Instead, **one TypeScript type crosses the client/server boundary by import.** You write server functions, export their _type_, and the client imports that type. The type is erased at build time, so nothing server-side ships to the browser — but the client gets full autocomplete and compile errors.

That's the whole trick. Everything else is plumbing.

| file                           | job                |
| ------------------------------ | ------------------ |
| `server/trpc.ts`               | init + context     |
| `server/router.ts`             | the API surface    |
| `app/api/trpc/[trpc]/route.ts` | the HTTP adapter   |
| `trpc/client.ts`               | the browser client |

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

| data                    | where        | why                                   |
| ----------------------- | ------------ | ------------------------------------- |
| Category list + counts  | Server (RSC) | changes rarely, needed on first paint |
| Blunders for a category | Client       | changes on every navigation           |
| Which blunder is active | Client state | pure interaction, no fetch            |

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

| file                                 | job                                    |
| ------------------------------------ | -------------------------------------- |
| `trpc/query-client.ts`               | new — the cache, configured            |
| `trpc/client.tsx`                    | provider + `useTRPC` (was `client.ts`) |
| `app/layout.tsx`                     | mount the provider                     |
| `app/[category]/blunder-browser.tsx` | the refactor — the actual lesson       |

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

Query cannot express that bug. Responses are filed under the key they were _requested_ with, and a component reads only the key it asked for. A late response for A writes to A's entry while the component is reading B's.

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

| flag         | means                                                            |
| ------------ | ---------------------------------------------------------------- |
| `isPending`  | no data in cache yet — nothing to render                         |
| `isFetching` | a request is in flight right now, including a background refresh |
| `isLoading`  | `isPending && isFetching` — the first load specifically          |

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

| gone                                | because                        |
| ----------------------------------- | ------------------------------ |
| `useState<number \| null>`          | the URL holds the selection    |
| the `blunders.detail` `useQuery`    | the server fetches it          |
| `isPending` / `error` on the detail | nothing is pending client-side |
| the summary-then-analysis split     | both arrive together           |
| `key={category}`                    | no client state left to reset  |
| `"use client"` on the whole panel   | no state, no handlers          |

The detail pane costs about 1.5 KB gzipped on the wire, and a route only ever renders the one position you opened — which is why the payload argument for keeping `detail` out of the list query stopped mattering the moment it became a URL.

Notice which mechanism did the work. Part 2.5 made the _list_ server-rendered by prefetching into the cache. This part made the _detail_ server-rendered by deleting the query.

> The cheapest query is the one you removed. Look at what is holding the state before reaching for a faster way to fetch it.

The list keeps its query. It is still interactive, and filtering and sorting are going to live there.

# Part 3 — Bucketing the List

## The one idea

Every row already knows what it is. `kind` is `checker`, `cube` or `both`, and the list has been printing it on all fifty lines:

```tsx
{
  kind;
}
{
  error_magnitude.toFixed(3);
}
```

Printing a value on every row is what you do when you have not grouped by it.

This part is array work: one pass to bucket the rows, then render the buckets.

Three files change:

| file                                       | why                                                   |
| ------------------------------------------ | ----------------------------------------------------- |
| `apps/web/lib/constants.ts`                | new — the bucket names                                |
| `apps/web/server/router.ts`                | `kind` gets a real type, and the row type is exported |
| `apps/web/app/[category]/blunder-list.tsx` | the grouping and the render                           |

---

## 1. `apps/web/lib/constants.ts` — new file

### The whole file

```ts
export const KINDS = ["checker", "cube", "both"] as const;

export type BlunderKind = (typeof KINDS)[number];
```

### The pieces

`KINDS` is the three bucket names **in the order they should appear on screen**. That second job matters — the render walks this array, so this is where display order is decided.

`as const` freezes it into a literal tuple rather than `string[]`, which is what makes `BlunderKind` the union `"checker" | "cube" | "both"` instead of `string`.

### Why its own file

Not `server/router.ts`, even though that is where the shape is defined. The list is a client component, and importing a _value_ from the router drags `server/trpc.ts` and then `server/db.ts` behind it, at which point the build dies trying to put `node:sqlite` in the browser bundle. Types are fine — they are erased — which is why `import type { Blunder }` below is safe and `import { KINDS }` from the same file would not be.

---

## 2. `apps/web/server/router.ts`

An existing file, so only the changed lines. Add the import:

```ts
import { KINDS } from "@/lib/constants";
```

Change `kind` in **both** `blunder` and `blunderDetail`:

```ts
  kind: z.enum(KINDS),   // was z.string()
```

And export the row type, which the list needs:

```ts
export type Blunder = z.infer<typeof blunder>; // was: type Blunder = …
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

import { KINDS, type BlunderKind } from "@/lib/constants";
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
{
  KINDS.map((kind) => {
    const blunders = byKind[kind];
    if (!blunders) return null;
    // …
  });
}
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

|                    | `Object.groupBy`                  | `reduce`                       |
| ------------------ | --------------------------------- | ------------------------------ |
| missing bucket     | absent, and you are made to check | absent, and nothing warns you  |
| first row of a key | handled                           | `acc[key] ??= []` or it throws |
| reads as           | "group these by kind"             | "fold these into an object"    |

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

## 1. `apps/web/lib/constants.ts`

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

**The table.** A sorted array plus `find` beats an `if/else` ladder because the bands become _data_: they can be rendered, counted, reordered, or eventually driven by a control. The same array classifies the rows and titles the headings.

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

import { KINDS, SEVERITY_BANDS, severityOf, type BlunderKind } from "@/lib/constants";
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
const bySeverity = Object.groupBy(blunders, (blunder) => severityOf(blunder.error_magnitude));
```

The only difference from the first call is that this callback _computes_ a key where the other _read_ one. `Object.groupBy` does not care; it wants a string.

**The second loop** walks `SEVERITY_BANDS` for the same reason the first walks `KINDS` — declared order, stable headings, and the same `if (!banded) return null` guard because the same rule applies at every level.

**The extracted leaf.** At three levels of nesting the JSX stopped fitting on a line, so `BlunderLinks` came out. Note it is the _leaf_ that was extracted, not the grouping: the grouping is the part worth reading in one place, the row markup was the part in the way. `selected` is threaded down as a prop rather than calling `useSelectedLayoutSegment` again — one call per list beats one per bucket, and it keeps the leaf a plain function of its props.

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

What cube blunders have that checker blunders don't is a _side_. You were either offering the cube or being offered it, and those are different skills — misjudging a double is not the same mistake as misjudging a take. So the cube bucket gets an extra level **above** severity, not instead of it:

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

| `cube_action`      | side      |
| ------------------ | --------- |
| `double_requested` | offering  |
| `dice_rolled`      | offering  |
| `double_accepted`  | receiving |
| `double_rejected`  | receiving |

---

## 1. `apps/web/lib/constants.ts`

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
} from "@/lib/constants";
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

Read it as: _for each band, if the bucket exists produce one group, otherwise produce nothing._

**It only flattens one level.** `[[1, [2]]].flatMap((x) => x)` gives `[1, [2]]`, not `[1, 2]`. If you need deeper that's `.flat(Infinity)` — and wanting it usually means the shape is wrong.

### Why not `.map().filter()`

The obvious alternative leaves you with a type you can't use:

```ts
SEVERITY_BANDS.map(({ id, label }) => ({ id, label, blunders: bySeverity[id] })).filter(
  (group) => group.blunders !== undefined,
); // blunders is still possibly undefined
```

`filter` narrows when the callback tests the value itself — `(x) => x !== undefined` — but not when it tests a _property_ of the value. There is no way to say "the same object, but that field is definitely there now".

`flatMap` sidesteps it by building the object only in the branch that has the data. Nothing is left to narrow, and it is one pass instead of two.

## Still open

The list is the worst fifty in the category, so a category with 300 blunders shows a sixth of itself and the sidebar count never matches. That is Part 4.

# Part 4 — Pagination

## The one idea

The sidebar says `middle_game` has 300. The list shows 50. Those two numbers have never agreed, and there has never been a way to reach row 51.

Pagination gets taught as a backend problem — `LIMIT`, `OFFSET`, ship it. That part is genuinely two lines. The interesting half is a frontend question: **where does the page number live?**

Part 2.7 already answered that exact question once, for the open blunder, and the answer was the URL. The same argument applies here — a page worth linking to, that survives a refresh. But this time the URL fights back, because of where the list happens to live.

| file                              | job                                                        |
| --------------------------------- | ---------------------------------------------------------- |
| `lib/constants.ts`                | the page size and the `?page` parser, shared by both sides |
| `server/router.ts`                | offset and a total — the brief bit                         |
| `app/[category]/blunder-list.tsx` | reads `?page`, draws the pager                             |
| `proxy.ts`                        | new — forwards the query string to the layout              |
| `app/[category]/layout.tsx`       | prefetches the page that was actually asked for            |

---

## 1. `apps/web/lib/constants.ts`

### The addition

```ts
export const PER_PAGE = 50;

/** `?page=` is whatever was in the URL bar, so anything that isn't a page is page 1. */
export function pageFrom(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}
```

### The pieces

**`PER_PAGE` is one number with two readers.** The server slices with it; the client divides `total` by it to know how many links to draw. They have to agree or the last page is wrong.

**`pageFrom` has two readers as well**, which is the only reason it lives here rather than beside the component that uses it — the list parses `?page` out of the browser's URL, and the layout parses the same value out of a request header. One parser, one set of rules, and no way for the two to disagree about what `?page=0` means.

It validates because a search param is an untrusted string that anyone can type. `Number(null)` is `0`, `Number("")` is `0`, `Number("abc")` is `NaN`, `Number("2.5")` is `2.5`. None of those is a page, and all of them land on 1.

This is also the reason the file exists at all, from Part 3: the list is a client component, so it cannot import a _value_ from the router without dragging `node:sqlite` into the browser bundle. Shared constants live here.

---

## 2. `apps/web/server/router.ts`

### The change

```ts
byCategory: publicProcedure
  .input(z.object({ category: z.string(), page: z.number().int().min(1).default(1) }))
  .output(z.object({ blunders: z.array(blunder), total: z.number() }))
  .query(({ ctx, input }) => {
    const rows = ctx.db
      .prepare(
        `SELECT b.blunder_id, b.kind, b.cube_action, b.error_magnitude,
                b.error_severity, b.played_notation, b.best_notation,
                b.match_length, b.score_black, b.score_white,
                c.doublers_best_action, c.receivers_best_action
         FROM blunders b
         JOIN blunder_categories bc ON bc.blunder_id = b.blunder_id
         LEFT JOIN cube_decisions c ON c.blunder_id = b.blunder_id
         WHERE bc.category = ?
         ORDER BY b.error_magnitude DESC
         LIMIT ? OFFSET ?`,
      )
      .all(input.category, PER_PAGE, (input.page - 1) * PER_PAGE);

    const { total } = ctx.db
      .prepare(`SELECT COUNT(*) AS total FROM blunder_categories WHERE category = ?`)
      .get(input.category) as { total: number };

    return { blunders: rows as unknown as Blunder[], total };
  }),
```

`PER_PAGE` joins the existing import from `@/lib/constants`. The column list is exactly the one from Part 3 — only the last line of the query and the return value are new.

### The pieces

Three things changed and none of them are clever.

**`limit` is gone, replaced by `page`.** Page size stopped being the caller's choice the moment a pager had to render a fixed number of links.

**`(page - 1) * PER_PAGE` is the whole of offset pagination.** Page 1 skips nothing, page 2 skips 50.

**The output went from an array to an object.** That is the change with a frontend blast radius: `data` is no longer the rows, so `data.length` becomes `data.blunders.length` everywhere below. It buys `total`, and without `total` you cannot draw `1 2 3 4 5 6` — you have no idea there are six.

---

## 3. `apps/web/app/[category]/blunder-list.tsx`

### The whole file

`bandsOf` and `groupsOf` are unchanged from Part 3.6 and elided here. `BlunderGroup` and `BlunderLinks` need one new prop each, shown below the file.

```tsx
"use client";

import Link from "next/link";
import { useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  CUBE_DIRECTIONS,
  cubeDirection,
  KINDS,
  KIND_LABELS,
  PER_PAGE,
  pageFrom,
  SEVERITY_BANDS,
  severityOf,
  type BlunderKind,
} from "@/lib/constants";
import type { Blunder } from "@/server/router";
import { useTRPC } from "@/trpc/client";

interface BlunderListProps {
  category: string;
}

export function BlunderList({ category }: BlunderListProps) {
  const trpc = useTRPC();

  const selected = useSelectedLayoutSegment();
  const page = pageFrom(useSearchParams().get("page"));

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category, page }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.total === 0) return <p>No blunders in this category.</p>;

  const byKind = Object.groupBy(data.blunders, (blunder) => blunder.kind);

  return (
    <div aria-busy={isFetching}>
      {KINDS.map((kind) => {
        const blunders = byKind[kind];
        if (!blunders) return null;

        return (
          <section key={kind}>
            <h2 style={{ margin: 0 }}>
              {KIND_LABELS[kind]} <data value={blunders.length}>({blunders.length})</data>
            </h2>

            {groupsOf(kind, blunders).map((group) => (
              <BlunderGroup
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

      <Pagination page={page} total={data.total} />
    </div>
  );
}

interface PaginationProps {
  page: number;
  total: number;
}

/** Every page listed. Fine at six; an ellipsis is a problem for another day. */
function Pagination({ page, total }: PaginationProps) {
  const pageCount = Math.ceil(total / PER_PAGE);
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav aria-label="Pagination">
      <ol style={{ display: "flex", gap: "0.5rem", listStyle: "none", padding: 0 }}>
        {pages.map((n) => (
          <li key={n}>
            <Link href={`?page=${n}`} aria-current={n === page ? "page" : undefined}>
              {n}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

### The pieces

**Reading the page.** `useSearchParams()` is the client-side read of the query string. It hands back a `ReadonlyURLSearchParams`, and `.get()` returns `string | null`.

**The page is now part of the cache key.** `queryOptions({ category, page })` gives each page its own entry, so page 1 is still sitting in the cache when you come back to it — instantly, no request. That is the same property that made switching categories cheap in Part 2, applied one level down.

**The pager.**

```tsx
const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
```

`Array.from` with a length and a mapper is the shortest honest way to write `[1…n]`.

`href={`?page=${n}`}` is a _relative_ href: it replaces the query string and keeps the current path, so paging while a blunder is open leaves that blunder open. `aria-current="page"` marks the one you're on. And the whole nav disappears at one page — `/close_out` has 7 rows and no business showing a pager.

**Carrying the page onto the blunder links.** The row links point at an absolute path, and an absolute path has no query string, so opening a blunder from page 6 silently drops you back to page 1. `page` has to be threaded down to the leaf and put back on:

```tsx
function BlunderLinks({ blunders, category, selected, page }: BlunderLinkProps) {
  // ...
  <Link href={`/${category}/${blunder_id}${page > 1 ? `?page=${page}` : ""}`}>
```

`BlunderGroup` gains a `page` prop for the same reason it already threads `selected` — it sits between the list and the leaf and has to pass it through. The `page > 1` check keeps page 1's URLs clean: `?page=1` and no param at all mean the same thing, and only one of them is worth putting in someone's address bar.

---

## 4. `apps/web/proxy.ts` — new file

Here is the problem this file exists to solve. The list lives in `[category]/layout.tsx`, and **layouts are not given `searchParams`** — only pages are. So the server rendering your HTML has no idea whether you asked for page 1 or page 6, and everything past page 1 arrives as `Loading...`. The gotchas below have the measurements and the reason the API is built that way.

Layouts don't get search params. They _do_ get request headers.

**The file is `proxy.ts`, not `middleware.ts`.** Next 16 renamed this convention. `middleware.ts` still works and warns — `The "middleware" file convention is deprecated. Please use "proxy" instead.` — and there is a codemod, `npx @next/codemod@canary middleware-to-proxy .`, which renames the exported function too. Almost everything written about this is still called middleware, so expect to translate as you read.

### The whole file

```ts
import { NextResponse, type NextRequest } from "next/server";

/**
 * Layouts are not given `searchParams`, but they are given the request headers.
 * Forwarding the query string here is what lets `[category]/layout.tsx` prefetch
 * the page that was actually asked for.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-search", request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|api).*)",
};
```

### The pieces

**`NextResponse.next({ request: { headers } })` rewrites the headers going _in_,** not the ones coming out. The browser never sees `x-search`; it exists for the duration of one render, which is exactly the lifetime you want for it.

**`request.nextUrl.search`** is the raw query string, `"?page=3"` or `""`. Passing the whole thing rather than just the page number means the next feature that needs a search param — sorting, in Part 5 — costs nothing here.

**The matcher earns its exclusions.** `_next/*` and `favicon.ico` are static assets that would gain a pointless hop, and `api` covers every tRPC call — those already carry their input in the URL and have no use for the header. This runs on every request that matches, so the matcher is the difference between a targeted fix and a tax on the whole app.

---

## 5. `apps/web/app/[category]/layout.tsx`

### The change

```tsx
import { headers } from "next/headers";
import { pageFrom } from "@/lib/constants";

// Layouts get no `searchParams`, but they do get headers — the proxy forwards
// the query string so the prefetch matches the page actually requested.
const search = (await headers()).get("x-search") ?? "";
const page = pageFrom(new URLSearchParams(search).get("page"));

await queryClient.query(trpc.blunders.byCategory.queryOptions({ category, page })).catch(noop);
```

### The pieces

**`headers()` is async and reading it makes the route dynamic.** `[category]` was already dynamic — it reads SQLite — so this costs nothing here. On a route you wanted static, this is the line that would quietly stop it being static, and only the `○` / `ƒ` in the build output would tell you.

**`new URLSearchParams(search)` gives the layout the same `.get()` the client has**, so the exact same `pageFrom` handles both. The server and the browser now parse `?page` with one function, which is the only way they can be guaranteed to agree.

**The `?? ""` matters.** If the proxy doesn't run — wrong matcher, or the file isn't picked up — the header is absent, `pageFrom(null)` returns 1, and you are back to the old behaviour rather than a crash. Degrading to "page 1 was server-rendered" is the right failure mode for a performance optimisation.

---

## Gotchas

### Layouts don't get `searchParams`

This is the constraint the part is built around, and it is not a bug. Run `next typegen` and read what Next generates for you:

```ts
interface PageProps<AppRoute extends AppRoutes> {
  params: Promise<ParamMap[AppRoute]>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type LayoutProps<LayoutRoute extends LayoutRoutes> = {
  params: Promise<ParamMap[LayoutRoute]>;
  children: React.ReactNode;
};
```

Pages get `searchParams`. Layouts get `params` and `children`, and that's it.

The reason is the thing Part 2.7 bought us. A layout is _reused_ across the navigations beneath it and does not re-render when only the query string changes — so handing it a `searchParams` it could not stay in sync with would be a lie. The API is honest about a tradeoff we opted into.

Our list lives in that layout and reads `?page`, so without the proxy the server rendering the HTML cannot know which page was asked for, while the browser can. Measured on `/middle_game` — 300 rows, six pages — before and after adding it:

| URL                   | without the proxy    | with the proxy |
| --------------------- | -------------------- | -------------- |
| `/middle_game`        | 50 rows              | 50 rows        |
| `/middle_game?page=2` | 0, plus `Loading...` | 50 rows        |
| `/middle_game?page=6` | 0, plus `Loading...` | 50 rows        |

The rows on page 1 and page 2 have no ids in common, which is the check worth running — "50 rows appeared" and "the _right_ 50 rows appeared" are different claims, and an off-by-one in the offset satisfies the first one happily.

The clearest way to see the constraint itself is a URL that trips both rules at once. Without the proxy, `/middle_game/17599806?page=3` server-renders the analysis panel in full while the list beside it says `Loading...`. Same request, same screen, two different answers — because the analysis comes from a page, which can read `?page`, and the list comes from a layout, which cannot.

The tempting shortcut is to move the list into `page.tsx` and take the `searchParams` for free. Don't: the list is rendered on both `/[category]` and `/[category]/[blunderId]`, so it would remount every time you open a blunder — which is exactly what Part 2.7 moved it into the layout to avoid. Six lines of proxy keeps both properties.

### The proxy only fixes the cold load, which is the point

Layouts still don't re-render when only the query string changes — that is what makes them layouts, and the proxy doesn't alter it. So clicking page 2 in the browser doesn't re-run the layout's prefetch; the client cache and `useQuery` handle that case, exactly as they did before.

Which is the correct division of labour. The warm case was never broken — a client navigation has a cache, and Part 4.6 warms it on hover. The cold case had no cache and no HTML, and that is the one this fixes.

### An absolute `href` throws the query string away

This is the bug you will actually hit, and nothing warns you. `<Link href={`?page=6`}>` is relative and keeps the path; `<Link href={`/${category}/${id}`}>` is absolute and keeps nothing. Once any state lives in the query string, every link in the app has to decide whether to carry it, and the default is to lose it.

The symptom is confusing because the list is right: you click a blunder on page 6, the URL becomes `/middle_game/17593171`, `?page` is gone, `pageFrom(null)` returns 1, and the list you are looking at snaps back to the first fifty — while the blunder you opened is still correctly displayed beside it, because _its_ id was in the path. Half the screen keeps its state and half loses it.

Worth knowing that this is exactly the class of problem `useSearchParams` and a helper solve at scale: as the number of params grows, hand-building hrefs stops being viable and you want one function that takes the current params, overrides a key, and returns the string. With one param, threading it is simpler and honest.

### The prefetch key still has to match exactly

Part 2.5's silent failure, with a fresh way to trigger it. `.default(1)` means the server happily accepts `{ category }` — but the query key is built from what you _passed_, not from what Zod filled in afterwards:

```
{ category: "middle_game" }             ← what the layout prefetched
{ category: "middle_game", page: 1 }    ← what the component asks for
```

Two different keys, so the hydrated entry is ignored and the browser refetches data that was already in the HTML. Pass `page` explicitly on both sides. Nothing fails: the build is green, the page works, it is just slower. Check the HTML, not the terminal.

### Offset or cursor

`OFFSET` is right here, and it's worth being able to say why it isn't always.

The database has to walk and discard every row it skips, so `OFFSET 100000` is genuinely slow. The bigger problem is that offsets count _positions_ in a result set: insert a row above your window between page 1 and page 2 and everything shifts down, so you see one row twice and never see another. Cursor pagination asks for "the 50 after _this row_" instead of "skip 50", which is stable under inserts and stays fast at any depth — but it cannot give you page numbers, because reaching page 4 means walking pages 1 through 3.

Our data is 1,380 rows from a batch scrape, six pages deep, with nobody inserting between clicks. Offset, and the numbered pages it makes possible, is the better trade. That reasoning is the interview answer — not "cursor is better".

# Part 4.5 — Keeping the Old Page On Screen

## The one idea

Click page 2 and the list vanishes, then comes back.

Nothing is broken. Page 2 is a different cache key, a key with nothing in it is `isPending`, and the first line of the component throws the entire list away when that's true:

```tsx
if (isPending) return <p>Loading...</p>;
```

That guard was written in Part 2 for a component that only ever had one thing to show. Now there is a perfectly good previous page on screen and we replace it with the word "Loading". The fetch isn't the problem — the guard is.

`placeholderData` is the fix, and it's one line: while this key is empty, show the last one's data.

---

## `apps/web/app/[category]/blunder-list.tsx`

### The change

```tsx
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const { isPending, isPlaceholderData, error, data } = useQuery({
  ...trpc.blunders.byCategory.queryOptions({ category, page }),
  placeholderData: keepPreviousData,
});
```

And the wrapper, which was reading `isFetching`:

```tsx
<div aria-busy={isPlaceholderData} style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
```

### The pieces

**The spread is the entire argument for the modern tRPC adapter.** `queryOptions()` returns a plain object, so adding a TanStack option is `...` and one more line. Part 2 claimed that composability as the reason to pick `@trpc/tanstack-react-query` over the old wrapper — this is the first time we actually cash it in. On the old API there is no object to spread into.

**`isPlaceholderData` is the flag to render against.** It is true exactly when what you're looking at belongs to a different key than the one you asked for: the old page, still on screen, while the new one loads. Dim it and the layout never collapses.

**`isPending` finally means what it says.** It now only fires when there is nothing to fall back to — the genuine first load. Every page change after that keeps its content, which is the difference between an app that feels fast and one that measures fast.

---

## Gotchas

### It's `keepPreviousData`, not `true`

v4 spelled this `keepPreviousData: true` as its own option. v5 removed it and replaced it with a function you hand to `placeholderData`. Any answer setting a boolean is out of date — the same v4/v5 trap as `isLoading` and `isPending` in Part 2.

The general shape is worth knowing: `placeholderData` takes any value, or a function `(previousData) => …`. `keepPreviousData` is just that function, returning the previous data unchanged, shipped for you.

### Placeholder data is never written to the cache

It is shown, not stored. Page 2's entry stays empty until page 2's real data lands, so there's no risk of stale rows being cached under the wrong key, and `isPlaceholderData` flips to false the moment the real thing arrives.

### It follows the hook, not the input

"Previous" means whatever this hook rendered last, whichever key that was — including a different _category_, not just a different page. That's harmless for us only because switching category server-renders and hydrates the new list, so real data is already in the cache and the placeholder never gets its chance. Worth checking before you reuse this on a query where that isn't true, because showing one category's rows under another category's heading is a convincing bug.

# Part 4.6 — Prefetching the Next Page

## The one idea

Part 2.5 prefetched on the server: fill the cache before the browser even exists. This does the same thing from inside the browser, and the timing is a gift — someone hovering a page link is roughly 200ms away from clicking it, which is plenty of time to already have the page.

Same cache, same keys, same idea. The only thing that's new is doing it _imperatively_ rather than declaring it and letting the cache decide.

---

## `apps/web/app/[category]/blunder-list.tsx`

### The change

```tsx
import { keepPreviousData, noop, useQuery, useQueryClient } from "@tanstack/react-query";

interface PaginationProps {
  category: string;
  page: number;
  total: number;
}

function Pagination({ category, page, total }: PaginationProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // ...pageCount and pages are unchanged...

  return (
    <nav aria-label="Pagination">
      <ol style={{ display: "flex", gap: "0.5rem", listStyle: "none", padding: 0 }}>
        {pages.map((n) => (
          <li key={n}>
            <Link
              href={`?page=${n}`}
              aria-current={n === page ? "page" : undefined}
              onMouseEnter={() =>
                queryClient
                  .query(trpc.blunders.byCategory.queryOptions({ category, page: n }))
                  .catch(noop)
              }
            >
              {n}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

`Pagination` takes `category` now — it needs it to build the key — so the call site becomes `<Pagination category={category} page={page} total={data.total} />`.

### The pieces

**`useQueryClient()` hands you the cache itself**, rather than a subscription to one entry in it. `useQuery` says "I need this, re-render me when it changes"; `queryClient.query()` says "go and get this, I'm not rendering it". Two jobs, one cache — and because the key is built the same way, the `useQuery` on the next render finds the entry already full.

**`.catch(noop)`, for the reason Part 2.5 gave.** `query()` returns a promise that rejects, and an unhandled rejection triggered by a mouse moving across a link is a silly way to meet an error overlay. A speculative fetch is allowed to fail silently — that's what makes it speculative.

**`staleTime` already stops you flooding the network.** Hovering the same link ten times does not fire ten requests: `query()` respects the 60-second `staleTime` set back in Part 2, so everything after the first resolves straight from cache. The prefetch gets to be naive because the cache policy isn't.

**Why not `prefetchQuery`.** It's what most write-ups reach for, and it is deprecated in v5 — `query(options).catch(noop)` is the replacement, exactly the same swap Part 2.5 made on the server side. Deprecated code still compiles and still lints, so this is one you only catch by reading the type.

---

## Gotchas

### Hover isn't a real event on a phone

`onMouseEnter` never fires on a touch device. It costs nothing and helps on desktop, which makes it a fine default, but treat it as an enhancement rather than the mechanism — the app has to be correct with the prefetch removed. `onPointerDown` fires on both and still buys you the gap between press and release, which is less time but not zero.

### Don't prefetch everything

Six links and a hover is fine. A loop that warms all six on mount is six queries to serve one, on a connection the user is currently using for the page they actually asked for. Prefetching is a bet on what happens next, and it stops paying the moment you bet on everything.

## Still open

The pager describes the category, but the buckets inside it still describe the page: `Checker plays (37)` means 37 of _these fifty_, not 37 of 300. Every heading count comes from `.length` on whatever happens to be loaded. Fixing that means counts computed by the database rather than by the component — which is really a filtering question, and that's Part 5.

From here: **Part 5** simple filters, **Part 6** mutations — a scratchpad textarea for notes on a blunder, which needs writing back to the database.

# Part 5 — Filters

**Already done for you, before this part starts.** A blunder stored as `kind = 'both'` used to be a single row holding two unrelated mistakes: a wrong cube decision, and then a wrong checker play on the same roll — filed together and measured by the checker error, so the cube half was sorted by the wrong number. Those nineteen rows are now split in the query into one checker decision and one cube decision each, so a row is one thing somebody got wrong. The change is already in your files: `KINDS` lost `both`, `server/router.ts` gained a `WITH_DECISIONS` clause that its queries start from, and the analysis panel prints one error line per decision. Nothing below depends on how that works — it matters here only because the kind filter now has two honest options instead of three.

**Also already done: the query itself.** `byCategory` takes `kinds`, `severities` and `directions` alongside `category` and `page`, and turns whatever it is handed into a `WHERE` — an empty array means no filter on that group, so sending all three empty is the unfiltered list you already have. It is a page of SQL assembled from string fragments, which is a backend problem and not what this document is about, so it isn't reproduced here. The one idea in it worth carrying anywhere else is in the gotchas below, under _build the condition, bind the value_. Everything that follows needs only the signature: send the three arrays, get back the rows that match and a total that counts them.

## The one idea

Hiding the mild blunders, or showing only cube decisions, looks like a job for the list component. It has the rows right there and `filter` is one line.

It isn't, and the reason is Part 4. The database already decides which fifty rows you get, so filtering in the browser filters those fifty:

| `/middle_game`        | page 1 | the whole category |
| --------------------- | ------ | ------------------ |
| catastrophic / severe | 9 / 41 | 9 / 55             |
| moderate / mild       | 0 / 0  | 166 / 74           |
| cube decisions        | 11     | 59                 |

"Only mild" would empty page 1 while the pager still offered seven pages, because the first mild row is on page 5. Anything that changes _which rows qualify_ has to run where the pagination runs.

That puts the filter values on the far side of the wire, so they have to travel with the request — and Part 2.7 already chose where that kind of state lives. The URL. It survives a refresh, it survives opening a blunder, and you can send it to someone. Part 4's `proxy.ts` forwards the whole query string to the layout already, and said at the time that the next param would cost nothing here. This is that bill arriving.

| file                              | job                                                     |
| --------------------------------- | ------------------------------------------------------- |
| `lib/constants.ts`                | one parser for `?kind=`, `?severity=` and `?direction=` |
| `server/router.ts`                | turns them into a `WHERE` — already done, above         |
| `app/[category]/layout.tsx`       | prefetches the page that was actually asked for         |
| `app/[category]/blunder-list.tsx` | reads the URL and asks for what it says                 |

---

## 1. `apps/web/lib/constants.ts`

### The whole file

```ts
export const PER_PAGE = 50;

/** No `both`: the query splits one of those into a checker decision and a cube decision. */
export const KINDS = ["checker", "cube"] as const;

export type BlunderKind = (typeof KINDS)[number];

export const KIND_LABELS: Record<BlunderKind, string> = {
  checker: "Checker plays",
  cube: "Cube decisions",
};

export const SEVERITY_BANDS = [
  { id: "catastrophic", label: "Catastrophic", min: 0.4 },
  { id: "severe", label: "Severe", min: 0.2 },
  { id: "moderate", label: "Moderate", min: 0.1 },
  { id: "mild", label: "Mild", min: 0 },
] as const;

export type BlunderSeverity = (typeof SEVERITY_BANDS)[number]["id"];

export function severityOf(errorMagnitude: number): BlunderSeverity {
  const band = SEVERITY_BANDS.find(({ min }) => errorMagnitude >= min);
  return band?.id ?? "mild";
}

export const CUBE_ACTION = [
  "double_accepted",
  "double_requested",
  "double_rejected",
  "dice_rolled",
] as const;

export type BlunderCubeAction = (typeof CUBE_ACTION)[number] | null;

export const CUBE_DIRECTIONS = [
  { id: "offer", label: "Offering the cube" },
  { id: "receive", label: "Being offered the cube" },
] as const;

export type CubeDirection = (typeof CUBE_DIRECTIONS)[number]["id"];

export function cubeDirection(direction: BlunderCubeAction): CubeDirection {
  if (direction === "double_accepted" || direction === "double_rejected") return "receive";
  return "offer";
}

/** The ids on their own: the filter validates against these, and so does the router. */
export const SEVERITIES = SEVERITY_BANDS.map(({ id }) => id);
export const DIRECTIONS = CUBE_DIRECTIONS.map(({ id }) => id);

/** An empty group means no filter on it, so this is also what "unfiltered" looks like. */
export interface BlunderFilters {
  kinds: BlunderKind[];
  severities: BlunderSeverity[];
  directions: CubeDirection[];
}

/** `?page=` is whatever was in the URL bar, so anything that isn't a page is page 1. */
export function pageFrom(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * The filters, read from `?kind=&severity=&direction=`. Anything that isn't one
 * of ours is dropped, and each group comes back in the constants' own order —
 * which is what lets the browser and the server build the same cache key from
 * the same URL. Takes anything with `getAll`, so the read-only search params in
 * the browser and a plain `URLSearchParams` on the server both fit.
 */
export function filtersFrom(params: Pick<URLSearchParams, "getAll">): BlunderFilters {
  const pick = <T extends string>(key: string, allowed: readonly T[]): T[] => {
    const chosen = new Set(params.getAll(key));
    return allowed.filter((value) => chosen.has(value));
  };

  return {
    kinds: pick("kind", KINDS),
    severities: pick("severity", SEVERITIES),
    directions: pick("direction", DIRECTIONS),
  };
}
```

### The pieces

**`pick` walks the allowed list, not the URL.** That's the whole validation: `?severity=banana` contributes nothing, because `banana` isn't in `SEVERITIES` to be found. Nothing throws and nothing 400s — a filter nobody understands is no filter, which is the right answer for a value anyone can type.

**The order comes from the constants, not the query string.** `?severity=severe&severity=mild` and `?severity=mild&severity=severe` both produce `["severe", "mild"]`, so both make the same cache key. Walking the URL instead would give two keys for one list — see the gotcha.

**One parser, both sides.** `Pick<URLSearchParams, "getAll">` is the smallest thing that works: the browser hands it `ReadonlyURLSearchParams`, the layout hands it a real `URLSearchParams`, and neither is imported here. Same argument as `pageFrom` in Part 4, one level up.

**`SEVERITIES` and `DIRECTIONS` are derived, not typed out again.** They are the ids of lists that already exist, so a new band or direction shows up in the filter, in `z.enum` on the server, and in the UI without being added anywhere by hand.

---

## 2. `apps/web/app/[category]/layout.tsx`

### The change

```tsx
import { filtersFrom, pageFrom } from "@/lib/constants";

const search = new URLSearchParams((await headers()).get("x-search") ?? "");
const page = pageFrom(search.get("page"));
const filters = filtersFrom(search);

await queryClient
  .query(trpc.blunders.byCategory.queryOptions({ category, page, ...filters }))
  .catch(noop);
```

The comment above those lines, about layouts getting headers instead of `searchParams`, stays exactly as Part 4 left it.

### The pieces

**The header is parsed once into `URLSearchParams`**, and `pageFrom` and `filtersFrom` both read it. Part 4 called `new URLSearchParams(search)` inline for one param; with four it is worth a name.

**`...filters` has to spread on both sides.** The prefetch key and the component's key are built from what was passed, and Part 4's gotcha applies unchanged: miss a param here and the browser silently refetches data that was already in the HTML. Nothing breaks, it is just slower, and only the HTML tells you.

---

## 3. `apps/web/app/[category]/blunder-list.tsx`

### The whole file

```tsx
"use client";

import { useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import { filtersFrom, KINDS, KIND_LABELS, pageFrom } from "@/lib/constants";
import { useTRPC } from "@/trpc/client";

import { BlunderListPagination } from "./subcomponents/blunder-list-pagination";
import { BlunderListGroup, groupsOf } from "./subcomponents/blunder-list-group";

interface BlunderListProps {
  category: string;
}

export function BlunderList({ category }: BlunderListProps) {
  const trpc = useTRPC();

  const selected = useSelectedLayoutSegment();
  const searchParams = useSearchParams();
  const page = pageFrom(searchParams.get("page"));
  const filters = filtersFrom(searchParams);

  const { isPending, isPlaceholderData, error, data } = useQuery({
    ...trpc.blunders.byCategory.queryOptions({ category, page, ...filters }),
    placeholderData: keepPreviousData,
  });

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.total === 0) {
    const filtered = Object.values(filters).some(({ length }) => length > 0);
    return <p>{filtered ? "No blunders match these filters." : "No blunders in this category."}</p>;
  }

  const byKind = Object.groupBy(data.blunders, (blunder) => blunder.kind);

  return (
    <div aria-busy={isPlaceholderData} style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
      <BlunderListPagination page={page} total={data.total} category={category} />
      {KINDS.map((kind) => {
        const blunders = byKind[kind];
        if (!blunders) return null;

        return (
          <section key={kind}>
            <h2 style={{ margin: 0 }}>
              {KIND_LABELS[kind]} <data value={blunders.length}>({blunders.length})</data>
            </h2>

            {groupsOf(kind, blunders).map((group) => {
              return (
                <BlunderListGroup
                  key={group.id}
                  group={group}
                  category={category}
                  selected={selected}
                  page={page}
                  depth={0}
                />
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
```

### The pieces

**Three lines do all of it.** Read the search params once, parse the page, parse the filters, spread them into the query input. The grouping, the buckets and the pager below are untouched — they were always rendering whatever the query returned, and now the query returns less.

**`data.total === 0` had to learn the difference** between a category with nothing in it and a filter that matches nothing, because they look identical from here and mean opposite things. `Object.values(filters).some(({ length }) => length > 0)` asks whether any group has a selection in it.

**Empty is not an error.** No `role="alert"`, no retry: the server answered, the answer is zero rows, and the pager vanishes on its own because `total / PER_PAGE` rounds up to zero pages.

---

## Gotchas

### Build the condition, bind the value

The filter query written for you follows one rule, and it holds anywhere something builds SQL: the string may be assembled, but every value in it is a `?`.

```ts
where.push(`d.kind IN (${input.kinds.map(() => "?").join(", ")})`);
params.push(...input.kinds);
```

The `IN` list has to be built, because its length depends on the input and there is no placeholder for "an array". What gets built is punctuation — `?, ?` — and the values still travel separately, where the driver can never mistake them for SQL. The version that ends up in incident reports is `IN ('${input.kinds.join("','")}')`, which is the same idea with the quotes in the wrong place.

`z.enum` narrows the input before any of this runs, so by the time these values reach the query they are already known strings. Both layers are worth having: the enum is what makes it _correct_, the placeholders are what make it _safe_.

### Array order is part of the cache key

The key is built from the input object, and `["mild", "severe"]` and `["severe", "mild"]` are different arrays. Both describe the same list, so a reader who ticks the boxes in the other order gets a second cache entry, a second request, and — worse — the server's prefetch key stops matching the client's, which is Part 2.5's silent refetch with a new way in.

Sorting into the constants' order inside `filtersFrom` is what stops that, and it costs nothing because that is where the values are already being checked. The general shape: anything that becomes a cache key wants a canonical form, and the parser is the natural place to impose one.

### A direction filter quietly means "cube"

Asking for `?direction=offer` returns cube decisions only, and no checker plays at all. That isn't a special case in the code — the condition also requires `d.kind = 'cube'`, so nothing else can match.

It is worth knowing that the version without that condition is subtly wrong rather than broken: a checker decision on a roll where the cube was never turned still has an action of `dice_rolled`, which `cubeDirection` maps to "offer", so checker plays would leak into a cube-only filter. Filtering on a field that only some rows have is exactly where this class of bug lives.

### The page you were on may not exist any more

`/middle_game?direction=offer&page=2` renders a heading and nothing else. The filter leaves 50 rows, page 2 starts at row 51, and `OFFSET 50` on a 50-row result is an empty page — with a pager that only offers one page, because the pager is drawn from the filtered total.

Nothing is wrong with the data and nothing throws. It's the same hole `?page=99` has had since Part 4, except filters make it easy to fall into, because narrowing the list is exactly the thing that removes the page you were standing on. Part 5.5 fixes it where it starts: changing a filter puts you back on page 1.

## Still open

The filters work, but only if you type them into the address bar, which is not a feature anyone can use. What follows, in order:

**Part 5.5 — the filter UI.** Checkboxes that write the URL, a page reset when a filter changes (the empty-page trap above), and the pager and row links carrying the params instead of dropping them.

**Part 5.6 — sort.** `?sort=worst|mildest`, an `ORDER BY` picked from a whitelist because a SQL keyword can't be a bound parameter, and a tie-breaker — 59 magnitudes are tied inside categories, and a sort without a unique tie-breaker can repeat or skip rows at a page boundary.

**Part 5.7 — counts from the database.** A `GROUP BY` so a heading can say `Checker plays (37 of 245)` rather than counting whatever landed on this page. This is what Part 4.6 left open.

**Part 5.8 — the URL on a library.** `nuqs`, defining each param once for the browser, the layout's prefetch and every link, and deleting `pageFrom`, `filtersFrom` and the hand-built query strings. The diff against what you typed here is the lesson.

**Part 5.9 — filters follow you.** The sidebar carries the filters and the sort into the next category but never the page, which needs the link — and only the link — to become a client component inside the server-rendered nav.

Then **Part 6**, mutations.

**Why none of this uses a store.** Part 5 was planned as filters in a global store — zustand rather than React context. It isn't one, because the server needs the filter values to run the query and the URL is how they travel; a store would be a second copy of state that already has a home, and two copies have to be kept in step forever. A store earns its place on state the server never needs and that separate parts of the tree share — a display preference read by both the list, which lives in the layout, and the analysis panel, which lives in the page, with no client component above them in common. That is the shape to look for when it does turn up, along with `persist` and the server/client hydration problem it brings.

# Part 5.5 — The Filter UI

## The one idea

Part 5 taught the URL to carry filters and the server to read them, then left you typing `?severity=mild` into the address bar by hand. Everything needed to finish the job is already in place. What is missing is that nothing _writes_ the URL.

That turns out to be the harder half, because the URL does not get written in one place. The checkboxes write it. The pager writes it. Every row link writes it. Part 5 gave you `filtersFrom`, a reader with no inverse, so each of those three would invent its own spelling of the same state — which is exactly how a filter disappears the moment you turn a page.

The rule underneath this part: **when the URL is your state, every link is a write.** A link that leaves a param out is not neutral about it, it clears it. The pager's `?page=2` was a complete and correct URL for as long as `page` was the only thing in it; the moment a second param exists, that same link is a "clear the filters" button wearing a page number. Nothing warns you, because nothing is broken — you just end up somewhere you didn't ask for.

| file                                                    | job                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `lib/constants.ts`                                      | `filterParams`, the inverse `filtersFrom` never had              |
| `app/[category]/blunder-filters.tsx`                    | the checkboxes — the only thing here that navigates              |
| `app/[category]/layout.tsx`                             | mounts the panel where the list's loading state can't swallow it |
| `subcomponents/blunder-list-pagination.tsx`             | pages _within_ the filters, and prefetches with them             |
| `subcomponents/blunder-list-group.tsx` and `-links.tsx` | carry a finished suffix down to the rows                         |
| `app/[category]/blunder-list.tsx`                       | builds that suffix, and wires the two above together             |

---

## 1. `apps/web/lib/constants.ts`

### The change

One function, appended. It is the mirror of `filtersFrom` directly above it:

```ts
/**
 * The inverse of `filtersFrom`: filters back out to `?kind=&severity=&direction=`,
 * in the constants' own order. It writes filters and nothing else — no `?page=` —
 * so a link built from it starts the filtered list at the beginning.
 */
export function filterParams({ kinds, severities, directions }: BlunderFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const kind of kinds) params.append("kind", kind);
  for (const severity of severities) params.append("severity", severity);
  for (const direction of directions) params.append("direction", direction);
  return params;
}
```

### The pieces

**It is deliberately an incomplete inverse.** `filtersFrom` reads a whole URL; `filterParams` writes only the filter part of one. It has no idea `?page=` exists and no way to write it. That refusal is not an oversight to patch later — it _is_ the page reset. Build a URL from this function and you have, by construction, a URL with no page in it, which `pageFrom` reads as page 1. The requirement "changing a filter sends you back to page 1" never becomes a line of code anywhere; it is a consequence of the only tool for the job being unable to do otherwise.

**The order is the constants' order, on the way out as well as in.** Part 5 made `filtersFrom` walk `KINDS` and `SEVERITIES` rather than the query string, so that two URLs describing the same filters produce one cache key. `filterParams` walks the same lists in the same direction, so the round trip is stable: parse a URL, serialize it back, and you get the same string. That property is what lets the next section launder a messy URL by simply passing it through both.

**It returns `URLSearchParams`, not a string.** Each caller needs `page` handled differently — the pager names a page on every link, a row link carries one only when it isn't page 1, and the checkboxes must not write one at all. Handing back a mutable object lets each of the three finish the sentence its own way, instead of forcing a `pageForLinks?: number` flag into a function that is clearer without one.

---

## 2. `apps/web/app/[category]/blunder-filters.tsx` — new file

### The panel

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  CUBE_DIRECTIONS,
  filterParams,
  filtersFrom,
  KINDS,
  KIND_LABELS,
  SEVERITY_BANDS,
} from "@/lib/constants";

interface BlunderFilterPanelProps {
  category: string;
}

export function BlunderFilterPanel({ category }: BlunderFilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = filtersFrom(searchParams);

  function toggle(param: string, value: string, checked: boolean) {
    const params = new URLSearchParams(searchParams);
    if (checked) params.append(param, value);
    else params.delete(param, value);

    // `filterParams` writes filters and nothing else, so `?page=` is gone by
    // construction — which is the reset a filter change needs.
    const query = filterParams(filtersFrom(params)).toString();
    router.push(query ? `/${category}?${query}` : `/${category}`);
  }

  return (
    <div style={{ display: "flex", gap: "2rem" }}>
      <FilterGroup
        legend="Kind"
        param="kind"
        options={KINDS.map((id) => ({ id, label: KIND_LABELS[id] }))}
        chosen={filters.kinds}
        onToggle={toggle}
      />
      <FilterGroup
        legend="Severity"
        param="severity"
        options={SEVERITY_BANDS}
        chosen={filters.severities}
        onToggle={toggle}
      />
      <FilterGroup
        legend="Cube"
        param="direction"
        options={CUBE_DIRECTIONS}
        chosen={filters.directions}
        onToggle={toggle}
      />
    </div>
  );
}
```

### The group

The checkboxes themselves, in the same file below it:

```tsx
interface FilterGroupProps {
  legend: string;
  param: string;
  options: readonly { id: string; label: string }[];
  chosen: readonly string[];
  onToggle: (param: string, value: string, checked: boolean) => void;
}

/** One group of checkboxes. The `name` is the query param it writes. */
function FilterGroup({ legend, param, options, chosen, onToggle }: FilterGroupProps) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend>{legend}</legend>
      {options.map(({ id, label }) => (
        <label key={id} style={{ display: "block" }}>
          <input
            type="checkbox"
            name={param}
            value={id}
            checked={chosen.includes(id)}
            onChange={(event) => onToggle(param, id, event.currentTarget.checked)}
          />{" "}
          {label}
        </label>
      ))}
    </fieldset>
  );
}
```

### The pieces

**There is no `useState` in this component.** A checkbox is the textbook `useState` example, and it would be wrong here: the URL already holds this state, the server already reads it, and a `useState` copy would be a second source of truth that has to be re-synced on every back button, every shared link and every navigation. `checked={chosen.includes(id)}` reads the URL. `onChange` writes the URL. The re-render arrives because the route changed. The component holds nothing, which is why there is nothing in it to get out of step.

**`params.delete(name, value)` takes two arguments now.** The second argument removes one specific name/value pair instead of every entry under that name, which is what a single checkbox turning off actually means. It landed in browsers around 2023 and in Node 20, so it is safe here and worth knowing, because the older spelling is a genuine trap:

```ts
// New: remove exactly this pair.
params.delete(param, value);

// Older fallback: there is no "remove one", so you empty the key and put the survivors back.
const kept = params.getAll(param).filter((v) => v !== value);
params.delete(param);
for (const v of kept) params.append(param, v);
```

The fallback is four lines and, note, re-appends at the end — which quietly moves that group to the back of the query string. Harmless here only because the round trip below re-sorts everything anyway.

**`filterParams(filtersFrom(params))` launders the URL.** It parses whatever is in the address bar and writes it back out clean: unknown params dropped, unknown values dropped, groups in the constants' order. So `?severity=banana&page=7&kind=cube` becomes `?kind=cube` on the next click without a single line that mentions `banana`, `page`, or sorting. This is the payoff for making both functions walk the constants rather than the input.

**It pushes `/${category}`, not `?…`.** A relative `?…` would keep the current path, and the current path may be `/middle_game/15987446` — a blunder that the new filter might exclude, leaving the analysis panel showing a row that isn't in the list beside it. Going to the category root closes it. The reasoning is the same as the page reset: narrowing a list can remove the thing you were looking at, so a filter change returns you to the top of the new list rather than to a stale position in it. The cost is real — you lose the open blunder on every tick — and the alternative, `router.push(\`?${query}\`)`, is one character away if you'd rather keep it.

**`query ? … : …` avoids a bare `?`.** Unticking the last checkbox produces an empty `URLSearchParams`, and `/middle_game?` is a URL nobody wants to see or share. The same shape appears again in section 4.

---

## 3. `apps/web/app/[category]/layout.tsx`

### The change

Two lines. An import, next to the one for the list:

```tsx
import { BlunderFilterPanel } from "./blunder-filters";
import { BlunderList } from "./blunder-list";
```

and the panel itself, between the heading and the flex row that holds the list and the analysis:

```tsx
<main>
  <h1>{category}</h1>
  <BlunderFilterPanel category={category} />
  <div style={{ display: "flex", gap: "3rem" }}>
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BlunderList category={category} />
    </HydrationBoundary>
    {children}
  </div>
</main>
```

The prefetch above it is untouched — Part 5 already taught it to read the filters.

### The pieces

**It is mounted in the layout, not inside the list.** The list was the tempting place — it already has the parsed filters sitting in a variable. But `BlunderList` returns `<p>Loading...</p>` before it renders anything, so the filter panel would vanish on the first load and reappear a moment later, and the control you just clicked would disappear from under the pointer. Putting it in the layout costs one prop and makes the panel independent of the query's state.

**It takes no filter props.** The panel is a client component reading `useSearchParams()` for itself, so a server component can mount it without having parsed anything. Two components read the same URL independently and agree, because the URL is the thing they agree on — no context, no store, no drilling.

---

## 4. `apps/web/app/[category]/subcomponents/blunder-list-pagination.tsx`

The next three sections go bottom-up: the two children that gain props are changed first, then the list that passes them. Typing them in that order leaves `blunder-list.tsx` briefly wrong — this section makes `filters` a required prop it does not yet pass, and the next one renames `page` to `query` underneath it. Both errors are in the list, both are expected, and section 6 clears them together. Nothing is broken; the compiler is just reading your unfinished sentence.

### The whole file

```tsx
"use client";

import { useQueryClient, noop } from "@tanstack/react-query";
import Link from "next/link";

import { useTRPC } from "@/trpc/client";
import { filterParams, PER_PAGE, type BlunderFilters } from "@/lib/constants";

interface BlunderListPaginationProps {
  page: number;
  total: number;
  category: string;
  filters: BlunderFilters;
}

export function BlunderListPagination({
  page,
  category,
  total,
  filters,
}: BlunderListPaginationProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const pageCount = Math.ceil(total / PER_PAGE);
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav aria-label="Pagination">
      <ol style={{ display: "flex", gap: "0.5rem", listStyle: "none", padding: 0 }}>
        {pages.map((n) => {
          // Rebuilt per link: a page number belongs to one page, the filters to all of them.
          const params = filterParams(filters);
          params.set("page", String(n));

          return (
            <li key={n}>
              <Link
                href={`?${params}`}
                aria-current={n === page ? "page" : undefined}
                onMouseEnter={() =>
                  queryClient
                    .query(trpc.blunders.byCategory.queryOptions({ category, page: n, ...filters }))
                    .catch(noop)
                }
              >
                {n}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

### The pieces

**`href={`?page=${n}`}` was the bug this part exists to fix.** It is a correct-looking link that silently clears every filter, and the failure mode is the worst kind: page 1 is right, so nothing seems wrong until page 2, by which point the list has changed under you and the URL looks like something you might have typed on purpose.

**The params are rebuilt inside the map.** `filterParams` returns a fresh mutable object and `params.set("page", …)` mutates it, so hoisting the call above the loop would leave every link pointing at whichever page was rendered last. Building one per iteration is a line of waste and a class of bug avoided.

**The prefetch key grew too, and that one is silent.** `queryOptions({ category, page: n, ...filters })` has to spread the filters for the same reason Part 2.5's prefetch did: the key is built from the input, so a prefetch without filters warms a cache entry the component will never ask for. Nothing errors — the hover simply stops doing anything, and the page you were promised instantly arrives at normal speed. The only way to notice is to watch for the request you were trying to avoid.

**Every pager link names its page, including page 1.** `?kind=cube&page=1` is redundant but honest, and `pageFrom` reads it as 1 either way. The alternative — omitting it, and so emitting a bare `?` for the unfiltered first page — costs more than the six characters it saves.

---

## 5. `blunder-list-group.tsx` and `blunder-list-links.tsx`

### The change

The same rename in both files: the `page: number` prop becomes `query: string`. In `blunder-list-group.tsx` that touches the props interface and the destructure:

```tsx
interface BlunderListGroupProps {
  group: BlunderListGroup;
  category: string;
  selected: string | null;
  query: string;
  depth: number;
}

export function BlunderListGroup({
  group,
  category,
  selected,
  query,
  depth,
}: BlunderListGroupProps) {
```

and the two places it hands the value on — the recursive `<BlunderListGroup>` and the `<BlunderListLinks>` below it — each swap `page={page}` for `query={query}`. Nothing else in that file changes.

`blunder-list-links.tsx` is short enough to show whole, and the link is where the value is finally spent:

```tsx
import Link from "next/link";

import type { Blunder } from "@/server/router";

interface BlunderListLinkProps {
  blunders: Blunder[];
  category: string;
  selected: string | null;
  query: string;
}

export function BlunderListLinks({ blunders, category, selected, query }: BlunderListLinkProps) {
  return (
    <ol>
      {blunders.map(({ blunder_id, error_magnitude, played_notation, cube_action, kind }) => (
        <li key={blunder_id}>
          <Link
            href={`/${category}/${blunder_id}${query}`}
            aria-current={String(blunder_id) === selected ? "page" : undefined}
          >
            [{error_magnitude.toFixed(3)}] {played_notation ? `${played_notation}` : null}{" "}
            {kind !== "checker" ? cube_action : null}
          </Link>
        </li>
      ))}
    </ol>
  );
}
```

### The pieces

**The leaf never wanted a page number.** It wanted a URL suffix, and `page` was the only ingredient back when the suffix had one ingredient. Passing the built string instead of the parts means adding a fourth filter group later touches `filterParams` and nothing else — the group component recurses past this value without ever knowing it changed shape.

**Prop drilling is the right call at this depth.** `query` passes through `BlunderListGroup`'s recursion untouched, which is the classic context-shaped itch. It is two levels and one string, and every component in the chain is already a client component that could call `useSearchParams()` for itself — which would be a third place parsing the URL and a third chance to spell it differently. One value, computed once, handed down.

---

## 6. `apps/web/app/[category]/blunder-list.tsx`

### The change

Three edits, all inside `BlunderList`. The import gains `filterParams`:

```tsx
import { filterParams, filtersFrom, KINDS, KIND_LABELS, pageFrom } from "@/lib/constants";
```

The link suffix is built once, directly under the two lines Part 5 added — shown with its neighbours so there is no guessing where it goes:

```tsx
const selected = useSelectedLayoutSegment();
const searchParams = useSearchParams();
const page = pageFrom(searchParams.get("page"));
const filters = filtersFrom(searchParams);

// What every link out of this list has to carry to come back to this view.
const params = filterParams(filters);
if (page > 1) params.set("page", String(page));
const query = params.size > 0 ? `?${params}` : "";
```

Then the two children each take one more prop — the ones sections 4 and 5 just taught to accept them:

```tsx
<BlunderListPagination page={page} total={data.total} category={category} filters={filters} />
```

```tsx
<BlunderListGroup
  key={group.id}
  group={group}
  category={category}
  selected={selected}
  query={query}
  depth={0}
/>
```

Nothing else in the file moves.

### The pieces

**Why the pager gets `filters` but the groups get `query`.** The two props look inconsistent and are not. They build different numbers of URLs. The pager builds one href per page — seven links, seven different `?page=` values, the same filters running through all of them — so it needs the ingredients and assembles each link itself. Every row link points at the view you are on right now: same page, same filters, one identical suffix repeated fifty times. So the list builds that string once and hands it down finished. Pass the finished value when there is exactly one; pass the parts when the child has to make several things out of them.

**One suffix, built once, for every row link below.** Each row wants "the URL I came from", so that opening a blunder and coming back lands on the same page of the same filtered list. Building it here rather than in the leaf also means the leaf never learns what a filter is.

**`page` is written only when it isn't 1.** Same rule Part 4 set: page 1 is the absence of `?page=`, not `?page=1`. It keeps the common URL short and keeps one spelling for one view, which matters because this string ends up in the address bar and in shared links.

**`params.size` is newer than it looks.** `URLSearchParams` had no `size` until 2023 — before that the idiom was `[...params].length`, or `toString()` for this exact test:

```ts
const query = params.size > 0 ? `?${params}` : ""; // today
const query = params.toString() ? `?${params}` : ""; // works anywhere, and reads fine
```

---

## Gotchas

### A link that forgets a param is a reset

This is the whole part in one line, and it generalises past this app: **the moment more than one thing lives in the query string, no link is allowed to be built from scratch.** Every `href` is a complete statement of where you'll be, including the parts it doesn't mention.

The tell is that it never breaks loudly. `?page=2` is a valid URL, the page renders, the query succeeds, and the reader is simply somewhere else than they asked to be. Grepping for backtick-`?` in a codebase is a surprisingly good audit: every hit is a link declaring that it knows the complete state of the URL.

### The prefetch key and the query key are two places, forever

Three times now this document has added a param, and three times the prefetch has had to be changed in lockstep — `page` in Part 4, the filters in Part 5's layout, the filters again in the pager here. The failure is always silent and always the same: a cache entry nobody asks for, and a refetch of data that was already on its way.

The structural fix is to stop hand-writing the input object in two places, and that is Part 5.8's argument for `nuqs` — define a param once, and the reader, the writer and both keys come from the definition.

### `checked` from the URL means nothing to keep in sync

Worth saying plainly because the instinct runs the other way: a checkbox whose `checked` comes from `useSearchParams()` has no local state, so the back button, a pasted link, a `router.push` from somewhere else and a server render all produce the right boxes with no effort. Had it been `useState`, each of those would be a bug to find — starting with the one where the panel is server-rendered with a filter applied and hydrates with every box empty.

### Changing a filter closes the open blunder

A deliberate choice, made in one line, and the one most likely to feel wrong later. Ticking "cube decisions" while reading a checker blunder navigates away from it, because the row you are reading is no longer in the list beside you. Keeping it open is defensible too — it's `router.push(\`?${query}\`)`instead — but then the analysis panel and the list disagree about what you're looking at, and`aria-current` points at a row that isn't rendered.

## Still open

The filters now work by pointing and clicking, and nothing about them survives leaving the category. What's left, in order:

**Part 5.6 — sort.** `?sort=worst|mildest`, an `ORDER BY` chosen from a whitelist because a SQL keyword cannot be a bound parameter, and a tie-breaker: 59 magnitudes are tied inside categories, and a sort without a unique tie-breaker can repeat or skip rows across a page boundary.

**Part 5.7 — counts from the database.** `Checker plays (37 of 245)` needs a `GROUP BY`, because every heading count in the list is still `.length` on whatever page happens to be loaded. This is the thread Part 4.6 left hanging.

**Part 5.8 — the URL on a library.** `nuqs`, defining each param once for the browser, the layout's prefetch and every link, then deleting `pageFrom`, `filtersFrom`, `filterParams` and every hand-built query string in this part. Diffing that against what you typed here is the lesson.

**Part 5.9 — filters follow you.** The sidebar carries the filters and the sort into the next category but never the page, which needs the link — and only the link — to become a client component inside the server-rendered nav.

Then **Part 6**, mutations.
