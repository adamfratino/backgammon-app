"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Group } from "@uiid/design-system";

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
 * and picks up the view once the browser has one. Which category you're in is
 * read here rather than inside that wait, because it comes from the path rather
 * than the query: the one you're on is marked in the first paint instead of
 * arriving a beat later with the filters.
 */
export function CategoryLink({ category, children }: CategoryLinkProps) {
  const { category: current } = useParams<{ category?: string }>();
  const active = category === current;

  return (
    <Suspense
      fallback={
        <CategoryRow href={`/${category}`} active={active}>
          {children}
        </CategoryRow>
      }
    >
      <ViewLink category={category} active={active}>
        {children}
      </ViewLink>
    </Suspense>
  );
}

interface ViewLinkProps extends CategoryLinkProps {
  active: boolean;
}

function ViewLink({ category, active, children }: ViewLinkProps) {
  const searchParams = useSearchParams();

  const params = viewParams(filtersFrom(searchParams), sortFrom(searchParams.get("sort")));
  const page = pageFrom(searchParams.get("page"));
  if (active && page > 1) params.set("page", String(page));

  const query = params.size > 0 ? `?${params}` : "";
  return (
    <CategoryRow href={`/${category}${query}`} active={active}>
      {children}
    </CategoryRow>
  );
}

interface CategoryRowProps {
  href: string;
  active: boolean;
  children: React.ReactNode;
}

/**
 * The row is the link, rather than a link sitting inside it. Laying the name and
 * the badge out itself is what puts the space between them inside the anchor, so
 * the whole row answers to a click — a link that only wrapped them left that gap
 * dead, and the padding around them with it.
 *
 * The padding, radius and tint are the same ones the design system paints an
 * option row with, so the category you're in is highlighted the way a chosen row
 * is highlighted everywhere else. There is no token for a selected list row yet,
 * so the tint is named here.
 */
function CategoryRow({ href, active, children }: CategoryRowProps) {
  return (
    <Group
      render={<Link href={href} />}
      // `aria-current` is the semantic half, which the design system writes but
      // never paints; the tint below is the half you can see.
      aria-current={active ? "page" : undefined}
      ax="space-between"
      ay="center"
      gap={2}
      fullwidth
      style={{
        padding: "var(--list-item-padding-y) var(--list-item-padding-x)",
        borderRadius: "var(--globals-border-radius)",
        backgroundColor: active ? "var(--shade-accent)" : undefined,
        // A box of its own is what makes the row clickable, and it is also what
        // gives the global anchor underline something to sit on. The name is a
        // row in a list, not a link in a sentence.
        textDecoration: "none",
      }}
    >
      {children}
    </Group>
  );
}
