"use client";

import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  BombIcon,
  CalendarArrowDownIcon,
  CalendarArrowUpIcon,
  FeatherIcon,
} from "@uiid/design-system/icons";

import {
  DEFAULT_TAB,
  filtersFrom,
  MATCH_SORTS,
  matchSortFrom,
  type MatchSort,
} from "@/lib/constants";
import { useTRPC } from "@/trpc/client";

import { FilterPanel, type FilterBounds } from "./blunder-filters";

/** A category's icons for the same two ends: a bomb for your worst ER, a feather for your best. */
const MATCH_SORT_ICONS: Record<MatchSort, typeof BombIcon> = {
  worst: BombIcon,
  best: FeatherIcon,
  newest: CalendarArrowDownIcon,
  oldest: CalendarArrowUpIcon,
};

/**
 * The matches page's panel: a category's filters, counted in matches, with the
 * match sorts in place of the blunder ones.
 */
export function MatchFilterPanel(bounds: FilterBounds) {
  const trpc = useTRPC();
  const searchParams = useSearchParams();
  const filters = filtersFrom(searchParams);

  // Held from a tick ago while the next ones land, as a category's are.
  const { data: counts } = useQuery({
    ...trpc.matches.filterCounts.queryOptions(filters),
    placeholderData: keepPreviousData,
  });

  return (
    <FilterPanel
      {...bounds}
      path="/matches"
      tab={DEFAULT_TAB}
      sorts={MATCH_SORTS}
      sortIcons={MATCH_SORT_ICONS}
      sort={matchSortFrom(searchParams.get("sort"))}
      counts={counts}
    />
  );
}
