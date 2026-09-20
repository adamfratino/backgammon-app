"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Button, Group } from "@uiid/design-system";
import { ChevronLeftIcon, ChevronRightIcon } from "@uiid/design-system/icons";

import type { Blunder } from "@/server/router";
import {
  blunderHref,
  filtersFrom,
  isOpen,
  pageFrom,
  PER_PAGE,
  sortFrom,
  viewParams,
} from "@/lib/constants";
import { useTRPC } from "@/trpc/client";

interface BlunderStepperProps {
  category: string;
  /** The open blunder's id, as it appears in the URL. */
  blunderId: string;
}

/**
 * Previous and next, in the order the category's table draws its rows. Nothing
 * is stored: where you are is the open blunder and the table's page, both in the
 * URL, and what sits either side comes from the table's own cached query.
 */
export function BlunderStepper({ category, blunderId }: BlunderStepperProps) {
  const trpc = useTRPC();

  const searchParams = useSearchParams();
  const selected = { id: blunderId, decision: searchParams.get("decision") };
  const page = pageFrom(searchParams.get("page"));
  const filters = filtersFrom(searchParams);
  const sort = sortFrom(searchParams.get("sort"));

  // The table's own input, so this reads the table's cache entry instead of
  // fetching the same page a second time.
  const view = { category, ...filters, sort };
  const { data } = useQuery(trpc.blunders.byCategory.queryOptions({ ...view, page }));

  const rows = data?.blunders ?? [];
  const index = rows.findIndex((row) => isOpen(row, selected));
  const pageCount = data ? Math.ceil(data.total / PER_PAGE) : 0;

  // On the first or last row, the neighbour is on the page next door. Fetch that
  // page only while the open blunder is actually sitting on the edge.
  const onFirstRow = index === 0 && page > 1;
  const onLastRow = index !== -1 && index === rows.length - 1 && page < pageCount;

  const { data: before } = useQuery(
    trpc.blunders.byCategory.queryOptions(onFirstRow ? { ...view, page: page - 1 } : skipToken),
  );
  const { data: after } = useQuery(
    trpc.blunders.byCategory.queryOptions(onLastRow ? { ...view, page: page + 1 } : skipToken),
  );

  function hrefFor(row: Blunder | undefined, onPage: number): string | null {
    if (row === undefined) return null;
    const params = viewParams(filters, sort);
    if (onPage > 1) params.set("page", String(onPage));
    return blunderHref(category, row, params.toString());
  }

  const previous =
    index > 0 ? hrefFor(rows[index - 1], page) : hrefFor(before?.blunders.at(-1), page - 1);

  const next =
    index !== -1 && index < rows.length - 1
      ? hrefFor(rows[index + 1], page)
      : hrefFor(after?.blunders[0], page + 1);

  return (
    <Group render={<nav />} gap={2} aria-label="Step through blunders" ax="space-between">
      <Step href={previous} tooltip="Previous blunder">
        <ChevronLeftIcon />
      </Step>
      <Step href={next} tooltip="Next blunder">
        <ChevronRightIcon />
      </Step>
    </Group>
  );
}

/**
 * A link that looks like a button, or a disabled button when there is nowhere to
 * go. A link can't be disabled, so the end of the list is a real `<button>`.
 */
function Step({
  href,
  tooltip,
  children,
}: {
  href: string | null;
  tooltip: string;
  children: React.ReactNode;
}) {
  if (href === null) {
    return (
      <Button size="xsmall" variant="subtle" shape="square" disabled tooltip={tooltip}>
        {children}
      </Button>
    );
  }

  return (
    <Button
      size="xsmall"
      variant="subtle"
      shape="square"
      render={<Link href={href} />}
      tooltip={tooltip}
    >
      {children}
    </Button>
  );
}
