import { headers } from "next/headers";
import { dehydrate, HydrationBoundary, noop } from "@tanstack/react-query";

import { filtersFrom, pageFrom, sortFrom } from "@/lib/constants";
import { getQueryClient, trpc } from "@/trpc/server";

import { BlunderList } from "./blunder-list";
import { BlunderFilterPanel } from "./blunder-filters";

interface CategoryLayoutProps {
  params: Promise<{ category: string }>;
  children: React.ReactNode;
}

export default async function CategoryLayout({ params, children }: CategoryLayoutProps) {
  const { category } = await params;

  const queryClient = getQueryClient();

  const search = new URLSearchParams((await headers()).get("x-search") ?? "");
  const page = pageFrom(search.get("page"));
  const filters = filtersFrom(search);
  const sort = sortFrom(search.get("sort"));

  await queryClient
    .query(trpc.blunders.byCategory.queryOptions({ category, page, ...filters, sort }))
    .catch(noop);

  return (
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
  );
}
