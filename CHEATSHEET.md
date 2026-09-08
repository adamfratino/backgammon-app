# Cheat sheet

The wiring and the signatures. Background reading is in [STUDY.md](./STUDY.md), full walkthroughs in [LEARNING.md](./LEARNING.md).

## The files

| file                           | job                                         |
| ------------------------------ | ------------------------------------------- |
| `server/trpc.ts`               | init + per-request context                  |
| `server/router.ts`             | the procedures, and `export type AppRouter` |
| `server/caller.ts`             | direct calls for Server Components          |
| `app/api/trpc/[trpc]/route.ts` | the one HTTP route                          |
| `trpc/query-client.ts`         | the cache, configured                       |
| `trpc/client.tsx`              | `"use client"` provider + `useTRPC`         |
| `trpc/server.tsx`              | server-side options proxy, for prefetching  |

### `server/trpc.ts`

```ts
export function createContext() {
  return { db }; // per request — never share across requests
}
type Context = ReturnType<typeof createContext>;

const t = initTRPC.context<Context>().create();
export const router = t.router;
export const publicProcedure = t.procedure;
```

### `server/router.ts`

```ts
export const appRouter = router({
  blunders: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().int().max(200).default(25) }))
      .output(z.array(blunder))
      .query(({ ctx, input }) => ctx.db.prepare(SQL).all(input.limit)), // .mutation() to write
  }),
});

export type AppRouter = typeof appRouter;
export type Blunder = z.infer<typeof blunder>;
```

### `server/caller.ts`

```ts
import "server-only";

export const caller = createCallerFactory(appRouter)(createContext);
```

### `app/api/trpc/[trpc]/route.ts`

```ts
const handler = (req: Request) =>
  fetchRequestHandler({ endpoint: "/api/trpc", req, router: appRouter, createContext });

export { handler as GET, handler as POST }; // named exports — a default export is a 405
```

### `trpc/query-client.ts`

```ts
export function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000 } } });
}
```

### `trpc/client.tsx`

```tsx
"use client";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient(); // server: one per request
  return (browserQueryClient ??= makeQueryClient()); // browser: one per tab
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc" })] }),
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

Both providers, same `queryClient` instance. Mount `<TRPCReactProvider>` in `app/layout.tsx`.

### `trpc/server.tsx`

```tsx
import "server-only";

export const getQueryClient = cache(makeQueryClient); // cache() or you dehydrate an empty client

export const trpc = createTRPCOptionsProxy({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});
```

## Calling a procedure

```ts
const trpc = useTRPC(); // client component → HTTP
await caller.blunders.list({ limit: 25 }); // server component → direct call, no network
trpc.blunders.list.queryOptions({ limit: 25 }); // server prefetch → same key as the client
```

Every procedure exposes `queryOptions` · `queryKey` · `queryFilter` · `mutationOptions`.

## Read

```tsx
const { data, error, isPending, isFetching } = useQuery(
  trpc.blunders.list.queryOptions({ limit: 25 }),
);

if (isPending) return <Spinner />; // both guards, or `data` is possibly undefined
if (error) return <Err e={error} />;
data.length; // narrowed
```

## Write

```ts
const { mutate } = useMutation(
  trpc.blunders.note.mutationOptions({
    onSuccess: () => qc.invalidateQueries(trpc.blunders.list.queryFilter({ limit: 25 })),
  }),
);
```

## Prefetch on the server

```tsx
const qc = getQueryClient();
await qc.query(trpc.blunders.list.queryOptions({ limit: 25 })).catch(noop); // await, not void

<HydrationBoundary state={dehydrate(qc)}>
  <List />
</HydrationBoundary>;
```

Same input on both sides or it's a different key, and `staleTime` must be non-zero or it refetches on mount anyway.

## Defaults

|                        |                                                     |
| ---------------------- | --------------------------------------------------- |
| `staleTime`            | `0` — how long to serve without refetching          |
| `gcTime`               | `5 min` — how long to keep after nothing renders it |
| `retry`                | `3`                                                 |
| `refetchOnWindowFocus` | `true`                                              |
| `isPending`            | no data yet                                         |
| `isFetching`           | in flight, including background refresh             |
| `isLoading`            | first load only                                     |

## Next.js

```tsx
const { category } = await params; // params is a Promise
notFound(); // returns never → narrows
useSelectedLayoutSegment(); // string | null — compare with String(id)

export const revalidate = 3600; // ISR
export const dynamic = "force-dynamic"; // per request
```

Build output: `○` static, built once · `ƒ` dynamic, per request. Layouts persist across navigation; pages re-render.

## Idioms

```tsx
<Child key={category} /> // reset state on prop change — not a useEffect
```

```js
Object.groupBy(rows, (r) => r.kind); // unseen keys are ABSENT — guard before .length
rows.reduce((a, r) => ((a[r.kind] ??= []).push(r), a), {}); // fallback

list.flatMap((x) => (keep ? [x] : [])); // map + filter in one pass
arr.toSorted(); // non-mutating (ES2023)
[...arr].sort(); // fallback — bare .sort() mutates, never on a prop
```

```ts
const KINDS = ["checker", "cube", "both"] as const;
type Kind = (typeof KINDS)[number]; // union, not string
const LABEL: Record<Kind, string> = { checker: "…", cube: "…", both: "…" }; // add a kind → won't compile

import type { AppRouter } from "@/server/router"; // erased; a value import ships the DB driver
```
