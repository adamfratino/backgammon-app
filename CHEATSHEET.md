# Cheat sheet

tRPC · TanStack Query · Next App Router · React state · JS/TS idioms. Concepts and the smallest snippet that shows each one. Background reading in [STUDY.md](./STUDY.md).

## tRPC

Typed RPC with no codegen and no schema file. The server exports a **type**, the client imports it, and types erase at build — so the client gets autocomplete and compile errors while nothing server-side ships to the browser.

```ts
const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  posts: t.router({
    list: t.procedure
      .input(z.object({ limit: z.number().default(20) }))
      .query(({ ctx, input }) => ctx.db.post.findMany({ take: input.limit })),

    create: t.procedure
      .input(z.object({ title: z.string().min(1) }))
      .mutation(({ ctx, input }) => ctx.db.post.create({ data: input })),
  }),
});

export type AppRouter = typeof appRouter; // the entire contract
```

```ts
import type { AppRouter } from "./router"; // type only — a value import ships your DB driver

const client = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc" })] });
```

- **Context** is built per request — DB handle, session. Never share it across requests.
- **`.query()` is a GET, `.mutation()` is a POST.** Calls fired in the same tick batch into one request.
- **It's just HTTP:** `GET /api/trpc/posts.list?input={"limit":2}` → `{"result":{"data":[…]}}`.
- **Zod isn't redundant.** Types vanish at runtime, so they protect nothing at a network boundary. `.input()` validates _and_ types the handler's argument from the same schema, so they can't drift.
- **Derive client types from the API:** `inferRouterOutputs<AppRouter>["posts"]["list"]`.

## Server vs client components

|                          | server (default) | client (`"use client"`) |
| ------------------------ | ---------------- | ----------------------- |
| `async` / await data     | yes              | no                      |
| state, effects, handlers | no               | yes                     |
| ships JS                 | no               | yes                     |
| secrets, DB              | yes              | never                   |

Default to server; push `"use client"` down to the leaf that actually needs interactivity.

A client provider does **not** make its children client components — anything passed as `children` was already rendered by the server parent:

```tsx
<ClientProvider>
  <ServerThing /> {/* still a server component */}
</ClientProvider>
```

That only holds while they arrive _as children_. If the client component `import`s it, the boundary moves and the server code comes along.

## TanStack Query

Not a fetching library — a **cache with a fetching policy**. You never say "fetch now"; you declare what a component needs under a key, and the cache decides if what it has is good enough.

```tsx
const { data, isPending, error } = useQuery({
  queryKey: ["posts", { limit: 20 }],
  queryFn: () => fetchPosts(20),
});

if (isPending) return <Spinner />; // both guards, or `data` is possibly undefined
if (error) return <Error e={error} />;
data.map(…); // narrowed
```

```tsx
const qc = useQueryClient();

useMutation({
  mutationFn: createPost,
  onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
});
```

**The key is the cache identity.** Different input, different entry — which is why revisiting is instant, and why the classic `useEffect` race condition can't happen: responses file under the key they were _requested_ with, so a slow response for A can't overwrite B.

|              | default | means                                                               |
| ------------ | ------- | ------------------------------------------------------------------- |
| `staleTime`  | `0`     | how long to serve without refetching — `0` refetches on every mount |
| `gcTime`     | `5 min` | how long to keep after nothing renders it                           |
| `isPending`  |         | no data yet                                                         |
| `isFetching` |         | in flight, including background refresh                             |
| `isLoading`  |         | first load only (`isPending && isFetching`)                         |

Render stale data with a subtle indicator on a background refetch; don't drop back to a spinner. (v4 called first-load `isLoading`; v5 renamed it `isPending`.)

## Server-rendering data a client component owns

Otherwise first paint is a spinner: the HTML arrives, the bundle loads, React hydrates, _then_ the fetch starts. So run it on the server and let the browser adopt the cache.

```tsx
const qc = new QueryClient();
await qc.query({ queryKey, queryFn }); // await, not void — useQuery doesn't suspend

<HydrationBoundary state={dehydrate(qc)}>
  <ClientList />
</HydrationBoundary>;
```

Two silent failures, neither caught by a build: **different key** on the two sides (it refetches anyway, and you paid twice), and **`staleTime: 0`** (hydrated data is stale on arrival). `void` only pays off with `useSuspenseQuery` under `<Suspense>`.

## Where state lives

|                  | for                                                | cost                                    |
| ---------------- | -------------------------------------------------- | --------------------------------------- |
| server component | slow-moving data needed at first paint             | not interactive                         |
| query cache      | server data that changes, shared across components | a cache to reason about                 |
| URL              | selection, filters, pagination                     | serialization                           |
| `useState`       | open/closed, hover, draft input                    | invisible to the server, lost on reload |

Moving a selection from `useState` into the URL deletes a loading state, a query, and the effect that reset it — the server knows a route param before any JS runs. The cheapest query is the one you removed.

## React

```tsx
<Child key={id} /> // reset state when a prop changes — never an effect
```

| instead of an effect           | do                                   |
| ------------------------------ | ------------------------------------ |
| derived data                   | compute in render                    |
| resetting state on prop change | `key`                                |
| fetching                       | a cache, loader, or server component |
| responding to a click          | the handler                          |

Effects are for syncing with something **outside** React: subscriptions, listeners, measurements. Always return cleanup — Strict Mode double-invokes in dev to catch its absence.

`useMemo`/`useCallback` buy nothing unless the value is expensive or feeds a `memo` child or a dep array. React 19: `ref` is a plain prop (no `forwardRef`), plus `use()`, `useActionState`, `useOptimistic`.

## Next App Router

```tsx
const { id } = await params; // params is a Promise
notFound(); // returns never → narrows below it

export const revalidate = 3600; // ISR
export const dynamic = "force-dynamic"; // per request
```

A server component that reads a database looks identical whether it runs once at build or per request — only the build output tells you: `○` static, `ƒ` dynamic. Layouts persist across navigation between their children, so data fetched in a layout doesn't refetch on every page change.

## Arrays

```js
Object.groupBy(rows, (r) => r.status); // { draft: [...], published: [...] }
```

Keys it never saw are **absent, not empty** — guard before reading `.length`. Key order follows first occurrence in the data, so render by mapping over a list you wrote down, not `Object.keys()`.

```js
// fallback when groupBy isn't available (ES2024 / Node 21 / lib: es2024)
rows.reduce((acc, r) => ((acc[r.status] ??= []).push(r), acc), {});
```

`??= []` is the whole trick — the first row for a key has no array to push onto.

```js
list.flatMap((x) => (keep(x) ? [x] : [])); // map + filter, one pass, flattens ONE level
```

Three legal answers: `[x]` keep, `[]` drop, `[a, b]` expand. It beats `.map().filter()` on types too — `filter` narrows the _value_, never a property of it, so the field stays possibly-`undefined`.

```js
arr.toSorted(fn); // ES2023 — sort/reverse/splice/push MUTATE
[...arr].sort(fn); // fallback; never sort a prop in place
```

`at(-1)` · `findLast()` · `x ?? y` (`||` also swallows `0` and `""`) · `[...new Set(a)]` · `structuredClone(x)` (JSON round-trip drops `Date`, `Map`, `undefined`).

## TypeScript

```ts
const STATUSES = ["draft", "published", "archived"] as const;
type Status = (typeof STATUSES)[number]; // union — without `as const` it's just string

const LABEL: Record<Status, string> = { draft: "…", published: "…", archived: "…" };
```

`Record<Union, T>` is a free exhaustiveness check: add a member and it stops compiling until you handle it.

`noUncheckedIndexedAccess` adds `| undefined` to every `arr[0]` and `obj[key]` — it's what makes the missing-bucket guard mandatory rather than defensive.
