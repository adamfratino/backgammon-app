"use client";

import { useQueryClient, noop } from "@tanstack/react-query";
import { Pagination } from "@uiid/design-system";
import Link from "next/link";

import { useTRPC } from "@/trpc/client";
import {
  DEFAULT_TAB,
  PAGE_SPREAD,
  PER_PAGE,
  viewParams,
  type BlunderFilters,
  type BlunderSort,
} from "@/lib/constants";

interface BlunderTablePaginationProps {
  page: number;
  total: number;
  category: string;
  filters: BlunderFilters;
  sort: BlunderSort;
}

export function BlunderTablePagination({
  page,
  category,
  total,
  filters,
  sort,
}: BlunderTablePaginationProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const pageCount = Math.ceil(total / PER_PAGE);
  // Pagination draws itself whatever the page count, so the one-page case stops here.
  if (pageCount <= 1) return null;

  // Rebuilt per link: a page number belongs to one page, the filters to all of them.
  // Paging is a move within the blunders half — the statistics have no pages —
  // so every link lands back on the half it was drawn under.
  const hrefFor = (n: number) => {
    const params = viewParams(filters, sort, DEFAULT_TAB);
    params.set("page", String(n));
    return `?${params}`;
  };

  return (
    <Pagination
      totalPages={pageCount}
      page={page}
      spread={PAGE_SPREAD}
      renderLink={(n) => (
        <Link
          href={hrefFor(n)}
          onMouseEnter={() =>
            queryClient
              .query(trpc.blunders.byCategory.queryOptions({ category, page: n, ...filters, sort }))
              .catch(noop)
          }
        />
      )}
    />
  );
}
