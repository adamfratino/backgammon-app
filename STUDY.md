# Study notes

Need the wiring or a signature? [CHEATSHEET.md](./CHEATSHEET.md) is the short one. This file is the background reading.

The concepts from [LEARNING.md](./LEARNING.md), compressed for a skim before an interview. One idea per section, then a table or a short snippet, then the traps. `LEARNING.md` is where the full walkthroughs live.

1. [tRPC](#1-trpc) · 2. [Next.js App Router](#2-nextjs-app-router) · 3. [TanStack Query](#3-tanstack-query) · 4. [React — where state lives](#4-react--where-state-lives) · 5. [React — hooks](#5-react--hooks) · 6. [Arrays & objects](#6-arrays--objects) · 7. [TypeScript](#7-typescript) · 8. [Rapid-fire](#8-rapid-fire)

---

## 1. tRPC

**The one idea.** No codegen, no schema file, no client to regenerate. You export one TypeScript _type_ from the server and the client imports it. Types are erased at build time, so nothing server-side ships to the browser — but the client gets full autocomplete and compile errors.

```ts
// server
export type AppRouter = typeof appRouter; // the entire contract

// client
const trpc = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc" })] });
```

**It's just HTTP.** The thing an interviewer is really checking when they ask how tRPC works:

```
GET /api/trpc/blunders.list?input={"limit":2}
→ {"result":{"data":[ … ]}}
```

Procedure path in the URL, input as a JSON query param, result under `result.data`. `.query()` is a GET and `.mutation()` is a POST — which is what decides cacheability. `httpBatchLink` merges calls fired in the same tick into `?batch=1&input={"0":{…}}`, so three components mounting is one round trip.

**Why Zod if you already have TypeScript.** Because **types vanish at runtime** — they protect you from nothing at a network boundary. `.input(schema)` is the runtime half, and the handler's argument type is _inferred from the schema_, so the two can't drift. `.output(schema)` points the same mechanism outward: it catches a data source that quietly changed shape, turning it into a 500 at the boundary instead of `undefined` exploding three renders later.

**Types flow out for free.** Components derive their types from the API itself — no shared types package, nothing to keep in sync:

```ts
type Blunder = inferRouterOutputs<AppRouter>["blunders"]["list"][number];
```

`inferRouterInputs` for the argument side.

| trap                                       | consequence                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| plain `import` instead of `import type`    | drags the DB driver into the client bundle                                                                                                |
| `export default handler` in App Router     | 405 — it needs `export { handler as GET, handler as POST }`                                                                               |
| anything shared across requests in context | context is built per request; sharing is a leak                                                                                           |
| `trpc.x.useQuery()`                        | that's the old `@trpc/react-query`; the current package is `@trpc/tanstack-react-query`, which returns `queryOptions()` and wraps nothing |

---

## 2. Next.js App Router

|                             | Server Component | Client Component         |
| --------------------------- | ---------------- | ------------------------ |
| default                     | yes              | only with `"use client"` |
| can be `async` / await data | yes              | no                       |
| state, effects, handlers    | no               | yes                      |
| ships JavaScript            | no               | yes                      |
| DB handles, secrets         | yes              | never                    |

**The composition rule people get wrong.** A `"use client"` provider does **not** make its children client components. `layout.tsx` stays a Server Component, `<Nav />` is evaluated _there_, and its finished output is handed to the provider as `children` — the provider renders a slot it never owns.

```tsx
<TRPCReactProvider>
  <Nav /> {/* rendered on the server, passed in as children */}
  {children}
</TRPCReactProvider>
```

This only holds because they arrive **as children**. If the client component `import`ed `<Nav />` itself, the boundary would move and the server code would come with it. Composition is what keeps the boundary honest.

**Layouts persist across navigation.** Next reuses a layout across navigations between its children, swapping only `children` — so data fetched in a layout doesn't re-fetch as you move between its pages. Put the same fetch in the page and it re-runs on every click.

**Static vs dynamic is invisible in the code.** A Server Component reading a database looks identical whether it runs once at build time or on every request. Nothing in the component tells you; only the build output does.

```
○ /             static — rendered once at BUILD time
ƒ /[category]   dynamic — rendered per request
```

The fix is one line: `export const revalidate = 3600` for ISR, `export const dynamic = "force-dynamic"` for always-fresh.

**Server-rendering data a client component owns: prefetch → dehydrate → hydrate.** A client component's `useQuery` can't run until the bundle loads and React hydrates, so first paint is a spinner even though the server had the data open when it wrote the HTML. So run the query on the server, serialize the cache into the HTML, and let the browser's `QueryClient` adopt it.

```tsx
const queryClient = getQueryClient();
await queryClient.query(trpc.x.queryOptions({ id })).catch(noop);

return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <ClientThing id={id} />
  </HydrationBoundary>
);
```

The client component doesn't change at all — it just stops ever seeing `isPending`.

| silent failure                    | why                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| prefetch input ≠ `useQuery` input | different keys, so the client ignores your prefetch and fetches anyway — while the HTML still carries the payload you paid to compute                                    |
| `staleTime: 0`                    | the hydrated entry is stale on arrival and refetches on mount. Prefetch and `staleTime` are a pair                                                                       |
| `void` instead of `await`         | `void` only pays off if something suspends. `useQuery` doesn't, so you run the query and still ship a spinner. `void` belongs with `useSuspenseQuery` under `<Suspense>` |

None of the three fails a build, a lint or a typecheck. Verify by curling the served page.

**Also worth naming:** `params` is a Promise (`const { id } = await params`); `notFound()` returns `never`, so it narrows and you never need `detail!`; URL segments are strings, so `useSelectedLayoutSegment()` returns `string | null` and comparing it to a number is silently always false.

---

## 3. TanStack Query

**The one idea.** It is not a fetching library, it's a **cache with a fetching policy**. `useState` + `useEffect` treats server data as if you own it — you don't. It's a local replica of something that lives elsewhere and can change without telling you. You never say "fetch now"; you declare what this component needs, under a key, and the cache decides whether the copy it has is good enough. Deduplication, background refetch, retries and staleness all fall out of that one reframing.

**The query key is the cache identity** — procedure path plus input:

```
[["blunders","byCategory"], { input: { category: "blitz" }, type: "query" }]
```

Different input, different entry. That's why revisiting is instant, and it's what makes invalidation addressable: `queryClient.invalidateQueries({ queryKey })`.

**The race condition it deletes** — the interview favourite. Hand-rolled, you navigate A → B, A's slower response lands _after_ B's, and `setState` writes the wrong data. Nothing about that code looks broken, which is why it survives code review. Query can't express the bug: responses are filed under the key they were _requested_ with, and a component only ever reads the key it asked for. A late response for A writes to A's entry.

| option      | the question it answers                              | default |
| ----------- | ---------------------------------------------------- | ------- |
| `staleTime` | how long may I serve this without asking again?      | `0`     |
| `gcTime`    | how long do I keep it after nothing is rendering it? | 5 min   |

`staleTime: 0` means every new mount refetches immediately — technically correct, and the reason people conclude the cache "isn't working". `staleTime` governs refetching, `gcTime` governs eviction.

| flag         | means                                                   |
| ------------ | ------------------------------------------------------- |
| `isPending`  | no data in cache yet — nothing to render                |
| `isFetching` | a request is in flight, including a background refresh  |
| `isLoading`  | `isPending && isFetching` — the first load specifically |

A background refetch over cached data is `isFetching: true` with `isPending: false`. Render the stale data with a subtle indicator; don't throw the user back to "Loading…". That distinction is most of what makes an app on this feel quick. v4 called the first-load flag `isLoading` and v5 renamed it to `isPending`, so v4 answers will mislead you.

**Guard both branches, not one.** `useQuery` returns a discriminated union, and only the success variant carries non-`undefined` data:

```tsx
if (isPending) return <Spinner />;
if (error) return <Error error={error} />;
data.length; // narrowed to the real type — no `?.` needed below
```

| current                                         | superseded                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `queryClient.query(options)` → `Promise<TData>` | `fetchQuery` / `prefetchQuery` — both deprecated in v5; `prefetchQuery`'s own JSDoc says to use `query()` and swallow errors with `.catch(noop)` |
| `trpc.x.queryOptions()` + `useQuery`            | `trpc.x.useQuery()` from `@trpc/react-query`                                                                                                     |

The `queryOptions()` split matters: it returns a plain options object, so the same builder composes with `useQuery`, `useSuspenseQuery`, `useQueries`, `prefetch` and `setQueryData`. The old wrapper-per-hook approach put tRPC permanently in the middle.

---

## 4. React — where state lives

Picking the right one of these is most of the design work.

| lives in     | good for                                                        | cost                                    |
| ------------ | --------------------------------------------------------------- | --------------------------------------- |
| Server (RSC) | slow-moving data needed on first paint                          | not interactive                         |
| Query cache  | server data that changes, shared across components              | a cache to reason about                 |
| URL          | selection, filters, pagination — anything shareable or linkable | serialization, navigation               |
| `useState`   | ephemeral interaction: open/closed, hover, draft input          | invisible to the server, lost on reload |

**The move worth citing in an interview.** Promoting a selection from `useState` into the URL deleted the loading state, a whole query, _and_ the effect that reset the selection on navigation — because a route param is something the server already knows before any JavaScript runs. And you get the thing state never could: a link.

> The cheapest query is the one you removed. Look at what's holding the state before reaching for a faster way to fetch it.

**Reset state with `key`, not an effect.**

```tsx
<Browser key={category} category={category} />
```

A changed `key` remounts the component, and remounting resets its state. State that's only meaningful for one value of a prop should be keyed on that prop. `useEffect(() => setSelected(null), [category])` is the anti-pattern this replaces.

**Derived values belong in render.** Don't mirror props into state. Compute during render and leave it there until something measures otherwise; `useMemo` is the next step, and Query's `select` the one after that.

---

## 5. React — hooks

**`useState` vs `useReducer`.** Reach for a reducer when the next state depends on the previous _and_ several values move together, or when the same transition is fired from many places. Rule of thumb: two or more `setX` calls that must always happen together are a reducer.

**`useMemo` / `useCallback` buy nothing unless** the value is genuinely expensive to compute, or it's a dependency of something memoized — a `memo` child, another hook's dep array. Wrapping a cheap object costs an allocation plus a dep array to get wrong. React Compiler removes most of the need; knowing it exists is the better answer than reciting memoization rules.

**When is `useEffect` actually correct?** Only for **synchronizing with something outside React**: a subscription, an event listener, a DOM measurement, a browser API, a non-React widget. Not for:

| instead of an effect                | do this                              |
| ----------------------------------- | ------------------------------------ |
| derived data                        | compute it during render             |
| resetting state when a prop changes | `key`                                |
| fetching                            | a cache (Query), a loader, or an RSC |
| responding to a user action         | do it in the event handler           |

**Cleanup isn't optional.** Return a teardown function. In development, Strict Mode mounts, unmounts and remounts every component to surface effects that don't clean up — the double-invoke is the feature, not a bug.

**`useRef`** is a mutable box that doesn't trigger a render: timer IDs, previous values, DOM nodes. In React 19, `ref` is an ordinary prop — `forwardRef` is no longer needed.

**React 19 additions worth naming**, even if you haven't shipped them: `use()` (read a promise or context, works with Suspense, and unlike other hooks may be called conditionally), `useActionState`, `useOptimistic`, `useFormStatus`.

**Rules of hooks, in one line:** top level, same order every render — because hooks are matched by call index, not by name.

---

## 6. Arrays & objects

### Grouping

```js
const byKind = Object.groupBy(rows, (r) => r.kind);
// { checker: [ … ], cube: [ … ] }   <- only the keys it actually saw
```

One pass, a callback returning a key, an object of arrays back. **The fallback**, for an older runtime or an older `lib` setting — and what most existing code looks like:

```js
const byKind = rows.reduce((acc, r) => {
  (acc[r.kind] ??= []).push(r);
  return acc;
}, {});
```

`??= []` is the whole trick: the first row for any key has no array to push onto yet. Forgetting it is the classic `Cannot read properties of undefined (reading 'push')`.

|                    | `Object.groupBy`                     | `reduce`                      |
| ------------------ | ------------------------------------ | ----------------------------- |
| missing bucket     | absent, and the type makes you check | absent, and nothing warns you |
| first row of a key | handled                              | `??= []` or it throws         |
| returns            | `Partial<Record<K, T[]>>`            | whatever you annotate         |
| reads as           | "group these by kind"                | "fold these into an object"   |

`reduce` is still right the moment the fold _isn't_ a grouping — a sum, a max, an index by id. Grouping specifically now has a better verb. `Map.groupBy` is the variant to use when the keys aren't strings, since it doesn't stringify them.

**Two rules that bite whichever you use:**

- It only creates keys it _saw_. A list with no cube rows has no `cube` key — not an empty array — so `.length` on it throws, in whatever case you didn't happen to open while developing. Always guard.
- Key order follows **first occurrence in the data**, not your intended order. Render by mapping over a list _you_ wrote down (`KINDS.map(...)`), so the order is stable and yours.

### `flatMap` — map and filter in one pass

It runs `map`, then flattens **one level** — so each input can produce one output, none, or many:

```js
[1, 2, 3].map((n) => [n, n * 10]); // [[1,10],[2,20],[3,30]]
[1, 2, 3].flatMap((n) => [n, n * 10]); // [1,10,2,20,3,30]
[1, 2, 3, 4].flatMap((n) => (n % 2 ? [n] : [])); // [1,3]
```

The callback has three legal answers: `[x]` keep it, `[]` drop it, `[a, b]` expand it. Only one level flattens — `[[1,[2]]].flatMap((x) => x)` gives `[1,[2]]`; wanting `.flat(Infinity)` usually means the shape is wrong.

**Why `flatMap` beats `.map().filter()`** — and this is a _types_ answer, which is what makes it a good one. `filter` narrows when the predicate tests the value itself (`(x) => x !== undefined`), but **not** when it tests a _property_ of the value. There's no way to say "the same object, but that field is definitely there now". `flatMap` sidesteps it by building the object only in the branch that has the data — nothing left to narrow, and one pass instead of two.

### Modern method → fallback

| modern                                  | fallback                                     | why you'd care                                                     |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `Object.groupBy(a, fn)`                 | `reduce` + `??= []`                          | ES2024 · Node 21 · needs `lib: es2024`                             |
| `Map.groupBy(a, fn)`                    | `Map` + `get`/`set`                          | keys that aren't strings                                           |
| `a.flatMap(fn)`                         | `.map(fn).filter(Boolean)`                   | ES2019 — safe everywhere                                           |
| `a.toSorted(fn)` · `a.toReversed()`     | `[...a].sort(fn)` · `[...a].reverse()`       | ES2023 · Node 20 — `.sort()` **mutates**                           |
| `a.with(i, v)` · `a.toSpliced(…)`       | `[...a]` then assign / `splice`              | ES2023                                                             |
| `a.at(-1)`                              | `a[a.length - 1]`                            | ES2022                                                             |
| `a.findLast(fn)`                        | `[...a].reverse().find(fn)`                  | ES2023                                                             |
| `x ?? y` · `x ??= y`                    | `x \|\| y`                                   | `\|\|` also swallows `0` and `""`                                  |
| `Object.hasOwn(o, k)`                   | `Object.prototype.hasOwnProperty.call(o, k)` | ES2022                                                             |
| `Object.entries` / `Object.fromEntries` | manual `for…in` and push                     | mapping over an object                                             |
| `structuredClone(x)`                    | `JSON.parse(JSON.stringify(x))`              | JSON silently drops `Date`, `Map`, `undefined`, and dies on cycles |
| `[...new Set(a)]`                       | `a.filter((v, i) => a.indexOf(v) === i)`     | O(n) instead of O(n²)                                              |

**The mutation trap, because it generates React bugs.** `sort`, `reverse`, `splice`, `push` and `shift` mutate in place. Sorting a prop or a cached array during render mutates data another component owns, and because the reference never changes, the re-render that should follow doesn't happen. `toSorted` / `toReversed` / `with` / `toSpliced` are the copying versions; `[...arr].sort()` is the fallback everywhere else.

---

## 7. TypeScript

**`as const` is what turns an array into a union.** It freezes a literal tuple instead of widening to `string[]`:

```ts
const KINDS = ["checker", "cube", "both"] as const;
type Kind = (typeof KINDS)[number]; // "checker" | "cube" | "both"
```

**`Record<Union, T>` is a free exhaustiveness check.** Add a member to the union and every `Record` over it stops compiling until you handle it — the cheapest way to make "we added a case and forgot the label" a build error rather than a blank spot on screen.

```ts
const KIND_LABEL: Record<Kind, string> = { checker: "…", cube: "…", both: "…" };
```

**Narrowing a discriminated union** is why both `useQuery` guards are needed — pending, error and success are distinct shapes. Destructuring is fine; TypeScript narrows destructured unions as long as the bindings are `const`, and the order of the guards doesn't matter.

**`filter` doesn't narrow a property**, only the value itself. Covered above under `flatMap` — the short interview version is _predicates narrow the value, not its fields_.

**`noUncheckedIndexedAccess`** adds `| undefined` to every index read (`arr[0]`, `obj[key]`). It's the flag that makes the missing-bucket guard mandatory instead of merely defensive, and it's a good answer to "which compiler options do you turn on?".

**`import type` is erased; a value import isn't.** At a client/server boundary that's the difference between a working build and a database driver in the browser bundle.

---

## 8. Rapid-fire

**How does tRPC give you end-to-end types with no codegen?** The client imports the router's _type_, not its code. Types are erased at compile time, so the type crosses the boundary and nothing else does.

**What actually goes over the wire?** Normal HTTP. Procedure path in the URL, input as a JSON query param, result under `result.data`; queries are GETs, mutations are POSTs, and same-tick calls get batched into one request.

**If TypeScript already gives you types, why Zod?** Types don't exist at runtime, so they protect nothing at a network boundary. Zod validates, and the handler's types are inferred from the schema so the two can't drift.

**Server Component or Client Component?** Slow-moving data needed at first paint goes server-side; anything with state, handlers or interaction is a client component. Default to the server and move the boundary down as far as it will go.

**Why TanStack Query if RSC can fetch?** Because RSC can't hold _interactive_ server state — a list that refetches, invalidates, or is shared across components. Prefetch on the server and hydrate to get both.

**What's wrong with `useEffect` + `useState` for fetching?** No caching, no dedup, no retries, manual loading and error state, and a race condition: navigate fast and a stale response overwrites a newer one. A key-based cache can't express that bug.

**What's `staleTime`, what's the default, why does it surprise people?** How long data can be served without refetching. The default is `0`, so every mount refetches — which is why people say the cache isn't working.

**How do you kill the first-paint spinner for client-fetched data?** Prefetch into a `QueryClient` on the server, `dehydrate` it into the HTML inside a `HydrationBoundary`, and the client's `useQuery` finds its entry already filled. Set a non-zero `staleTime` or it refetches immediately anyway.

**How do you reset a component's state when a prop changes?** Change its `key`. Remounting resets state; an effect that calls setters is the anti-pattern.

**When is `useEffect` the right tool?** When synchronizing with something outside React — a subscription, a listener, a measurement. Not for derived data, not for resetting state, not for fetching, not for responding to an event.

**`Object.groupBy` isn't available — now what?** A `reduce` with `(acc[key] ??= []).push(item)`. Same result; the `??=` handles the first row of each key, and forgetting it is the classic crash.

**Why `flatMap` instead of `.map().filter()`?** One pass, and it actually types: `filter` narrows the value but not a property of it, so `.map().filter()` leaves the field still possibly `undefined`. `flatMap` builds the object only in the branch that has the data.
