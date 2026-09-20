import { headers } from "next/headers";
import { dehydrate, HydrationBoundary, noop } from "@tanstack/react-query";
import { Stack } from "@uiid/design-system";

import { CategoryTopbar } from "@/components/category-topbar";
import { filtersFrom, pageFrom, sortFrom, tabFrom } from "@/lib/constants";
import { getQueryClient, trpc } from "@/trpc/server";

interface CategoryLayoutProps {
  params: Promise<{ category: string }>;
  children: React.ReactNode;
}

/**
 * The topbar, and the page of the list the URL asks for — when the URL is asking
 * for the list at all. The table draws that page, and a blunder's Previous and
 * Next read their neighbours from it, so both pages below start with it already
 * in the cache; a category opened on its statistics has no rows to draw and
 * skips it.
 */
export default async function CategoryLayout({ params, children }: CategoryLayoutProps) {
  const { category } = await params;

  const queryClient = getQueryClient();

  const search = new URLSearchParams((await headers()).get("x-search") ?? "");
  const page = pageFrom(search.get("page"));
  const filters = filtersFrom(search);
  const sort = sortFrom(search.get("sort"));

  // Only the half that is showing is worth the query. A blunder's page carries
  // no `?tab=` — its links are built with the default — so it still reads as the
  // blunders half and Previous and Next still land on a warm cache.
  if (tabFrom(search.get("tab")) === "blunders") {
    await queryClient
      .query(trpc.blunders.byCategory.queryOptions({ category, page, ...filters, sort }))
      .catch(noop);
  }

  return (
    <Stack render={<main />} ax="stretch" minw={0} style={{ flex: 1 }}>
      <CategoryTopbar category={category} />
      <HydrationBoundary state={dehydrate(queryClient)}>{children}</HydrationBoundary>
    </Stack>
  );
}
