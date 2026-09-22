"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { categoryHref } from "@/lib/constants";

import { SidebarLink, type SidebarLinkProps } from "./sidebar-link";

interface CategoryLinkProps extends Omit<SidebarLinkProps, "href" | "active"> {
  category: string;
}

/**
 * A category in the sidebar. It carries the filters and sort in the URL, so they
 * hold when you switch categories, and for the category you're in it keeps the
 * page too — from a blunder, that makes it the way back to the rows you left.
 *
 * `/` is prerendered before any URL exists, so there it starts as a plain link
 * and picks up the view once the browser has one. Which category you're in is
 * read here rather than inside that wait, because it comes from the path rather
 * than the query: the one you're on is marked in the first paint instead of
 * arriving a beat later with the filters.
 */
export function CategoryLink({ category, ...props }: CategoryLinkProps) {
  const { category: current } = useParams<{ category?: string }>();
  const active = category === current;

  return (
    <Suspense fallback={<SidebarLink href={`/${category}`} active={active} {...props} />}>
      <ViewLink category={category} active={active} {...props} />
    </Suspense>
  );
}

interface ViewLinkProps extends CategoryLinkProps {
  active: boolean;
}

function ViewLink({ category, active, ...props }: ViewLinkProps) {
  const searchParams = useSearchParams();

  return (
    <SidebarLink
      href={categoryHref(category, searchParams, { keepPage: active })}
      active={active}
      {...props}
    />
  );
}
