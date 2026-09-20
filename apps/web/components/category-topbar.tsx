"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Breadcrumbs, Stack } from "@uiid/design-system";

import { categoryHref, categoryLabel } from "@/lib/constants";

interface TrailProps {
  category: string;
  /** The open blunder's id, or nothing when the category's list is what's open. */
  blunderId: string | undefined;
}

/**
 * Where you are, and the way out — the whole of the topbar, so it stays a thin
 * band of bearings rather than a place things accumulate. The category crumb
 * links back to the rows you left, same filters, same sort, same page, so
 * stepping into a blunder and back out returns you to the list rather than the
 * top of it. The sidebar's category link already did that; this puts it where
 * you are looking when you want out, and names the blunder you're in on the way.
 *
 * Which of the two pages is open is read off the route rather than passed in,
 * because a layout cannot see the child route it wraps.
 */
export function CategoryTopbar({ category }: { category: string }) {
  const { blunderId } = useParams<{ blunderId?: string }>();

  return (
    <Stack
      px={6}
      py={4}
      bb={1}
      style={{ position: "sticky", top: 0, zIndex: 1, backgroundColor: "var(--shade-background)" }}
    >
      <Suspense
        fallback={<Trail category={category} blunderId={blunderId} href={`/${category}`} />}
      >
        <ViewTrail category={category} blunderId={blunderId} />
      </Suspense>
    </Stack>
  );
}

/**
 * Reading the URL's view has to happen under a Suspense boundary, so the trail
 * is drawn once without it and again with it. That first pass points the crumb
 * at the plain list — the same place, just without the rows you had open.
 */
function ViewTrail({ category, blunderId }: TrailProps) {
  const searchParams = useSearchParams();
  const href = categoryHref(category, searchParams, { keepPage: true });
  return <Trail category={category} blunderId={blunderId} href={href} />;
}

/**
 * `href` is the category crumb's, and the only one worth working out: the root
 * is fixed, and the blunder is the page you're on, which Breadcrumbs draws as
 * plain text rather than a link back to itself.
 */
function Trail({ category, blunderId, href }: TrailProps & { href: string }) {
  const items = [
    { label: "Blunders", value: "/" },
    { label: categoryLabel(category), value: href },
  ];

  if (blunderId !== undefined) {
    items.push({ label: `#${blunderId}`, value: `/${category}/${blunderId}` });
  }

  return <Breadcrumbs items={items} linkAs={Link} />;
}
