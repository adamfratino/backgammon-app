import { headers } from "next/headers";
import { dehydrate, HydrationBoundary, noop } from "@tanstack/react-query";

import { filtersFrom, pageFrom } from "@/lib/constants";
import { getQueryClient, trpc } from "@/trpc/server";
import { BlunderList } from "./blunder-list";

interface CategoryLayoutProps {
  params: Promise<{ category: string }>;
  children: React.ReactNode;
}

export default async function CategoryLayout({ params, children }: CategoryLayoutProps) {
  const { category } = await params;

  const queryClient = getQueryClient();
  // Layouts get no `searchParams`, but they do get headers — middleware forwards
  // the query string so the prefetch matches the page actually requested.
  const search = new URLSearchParams((await headers()).get("x-search") ?? "");
  const page = pageFrom(search.get("page"));
  const filters = filtersFrom(search);

  await queryClient
    .query(trpc.blunders.byCategory.queryOptions({ category, page, ...filters }))
    .catch(noop);

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
