"use client";

import { useQueryClient, noop } from "@tanstack/react-query";
import Link from "next/link";

import { useTRPC } from "@/trpc/client";
import { PER_PAGE, viewParams, type BlunderFilters, type BlunderSort } from "@/lib/constants";

interface BlunderListPaginationProps {
  page: number;
  total: number;
  category: string;
  filters: BlunderFilters;
  sort: BlunderSort;
}

export function BlunderListPagination({
  page,
  category,
  total,
  filters,
  sort,
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
          const params = viewParams(filters, sort);
          params.set("page", String(n));

          return (
            <li key={n}>
              <Link
                href={`?${params}`}
                aria-current={n === page ? "page" : undefined}
                onMouseEnter={() =>
                  queryClient
                    .query(
                      trpc.blunders.byCategory.queryOptions({
                        category,
                        page: n,
                        ...filters,
                        sort,
                      }),
                    )
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
