"use client";

import { useQueryClient, noop } from "@tanstack/react-query";
import Link from "next/link";

import { useTRPC } from "@/trpc/client";
import { PER_PAGE } from "@/lib/constants";

interface BlunderListPaginationProps {
  page: number;
  total: number;
  category: string;
}

export function BlunderListPagination({ page, category, total }: BlunderListPaginationProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const pageCount = Math.ceil(total / PER_PAGE);
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

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
