"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Group, Toggle, ToggleGroup } from "@uiid/design-system";
import { ChartPieIcon, TableIcon } from "@uiid/design-system/icons";

import {
  CATEGORY_TABS,
  type CategoryTab,
  filtersFrom,
  sortFrom,
  tabFrom,
  viewParams,
} from "@/lib/constants";

/**
 * The shape each half draws — rows against a divided circle — so the pair reads
 * as two forms of the same figures rather than two destinations. Kept here
 * rather than beside the labels in the constants, which the server imports and
 * which has no business holding components.
 */
const TAB_ICONS: Record<CategoryTab, typeof TableIcon> = {
  blunders: TableIcon,
  statistics: ChartPieIcon,
};

/**
 * The switch, beside the category's name rather than over either half: what it
 * changes is what the whole page is showing, and both halves answer to the same
 * filters.
 *
 * It writes `?tab=` and lets the page read it back, so a half is an address
 * rather than something the browser remembers — the statistics can be linked to,
 * and survive a reload, the way a filter or a sort already does. Written through
 * `viewParams` like every other change to this URL, which is what keeps the
 * filters and the sort on as you cross between halves.
 */
export function CategoryViewToggle({ category }: { category: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFrom(searchParams.get("tab"));

  return (
    <ToggleGroup
      aria-label="View"
      size="xsmall"
      value={[tab]}
      // A tab is always showing, so pressing the pressed one hands back nothing
      // and matches nothing here — which leaves the URL alone rather than
      // spending a round trip to arrive where we already are.
      onValueChange={([next]) => {
        const picked = CATEGORY_TABS.find(({ id }) => id === next);
        if (!picked) return;

        const params = viewParams(
          filtersFrom(searchParams),
          sortFrom(searchParams.get("sort")),
          picked.id,
        );
        router.push(params.size > 0 ? `/${category}?${params}` : `/${category}`);
      }}
    >
      {/* A toggle is a bare button, and unlike `Button` it holds no gap of its
          own, so the icon and the word it names are grouped the way `Button`
          groups its own content — `ay="center"` at the same gap of 2.

          The label is wrapped rather than left as a bare string because the
          toggle collapses to a square, padding and all, on
          `:has(svg:only-child)` — and a text node is not a child for the
          purposes of `:only-child`, so an unwrapped word still leaves the icon
          an only child and the label with nowhere to go. */}
      {CATEGORY_TABS.map(({ id, label }) => {
        const Icon = TAB_ICONS[id];

        return (
          <Toggle key={id} value={id}>
            <Group ay="center" gap={2}>
              {/* The toggle sizes an icon's height off `--forms-icon-size` but
                  never its width, where `Button` sets `width: auto` beside it;
                  without that the glyph keeps the 24 it ships with and draws
                  short and wide inside it. */}
              <Icon style={{ width: "auto" }} />
              <span>{label}</span>
            </Group>
          </Toggle>
        );
      })}
    </ToggleGroup>
  );
}
