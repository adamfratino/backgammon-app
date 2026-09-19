"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { filtersFrom, pageFrom, sortFrom, viewParams } from "@/lib/constants";

interface CategoryLinkProps {
  category: string;
  children: React.ReactNode;
}

/**
 * A category in the sidebar. It carries the filters and sort in the URL, so they
 * hold when you switch categories, and for the category you're in it keeps the
 * page too — from a blunder, that makes it the way back to the rows you left.
 *
 * `/` is prerendered before any URL exists, so there it starts as a plain link
 * and picks up the view once the browser has one.
 */
export function CategoryLink({ category, children }: CategoryLinkProps) {
  return (
    <Suspense fallback={<CategoryHref href={`/${category}`}>{children}</CategoryHref>}>
      <ViewLink category={category}>{children}</ViewLink>
    </Suspense>
  );
}

function ViewLink({ category, children }: CategoryLinkProps) {
  const searchParams = useSearchParams();
  const { category: current } = useParams<{ category?: string }>();

  const params = viewParams(filtersFrom(searchParams), sortFrom(searchParams.get("sort")));
  const page = pageFrom(searchParams.get("page"));
  if (category === current && page > 1) params.set("page", String(page));

  const query = params.size > 0 ? `?${params}` : "";
  return <CategoryHref href={`/${category}${query}`}>{children}</CategoryHref>;
}

function CategoryHref({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ display: "contents" }}>
      {children}
    </Link>
  );
}
