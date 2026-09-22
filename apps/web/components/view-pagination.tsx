"use client";

import { Pagination } from "@uiid/design-system";
import Link from "next/link";

import { PAGE_SPREAD, PER_PAGE } from "@/lib/constants";

interface ViewPaginationProps {
  page: number;
  total: number;
  /** The view every page carries — filters and sort, from `viewParams` — without its `?page=`. */
  view: string;
  /** Warms a page on hover, for a list the browser fetches for itself. */
  prefetch?: (page: number) => void;
}

export function ViewPagination({ page, total, view, prefetch }: ViewPaginationProps) {
  const pageCount = Math.ceil(total / PER_PAGE);
  // Pagination draws itself whatever the page count, so the one-page case stops here.
  if (pageCount <= 1) return null;

  // Rebuilt per link: a page number belongs to one page, the view to all of them.
  const hrefFor = (n: number) => {
    const params = new URLSearchParams(view);
    params.set("page", String(n));
    return `?${params}`;
  };

  return (
    <Pagination
      totalPages={pageCount}
      page={page}
      spread={PAGE_SPREAD}
      renderLink={(n) => <Link href={hrefFor(n)} onMouseEnter={prefetch && (() => prefetch(n))} />}
    />
  );
}
