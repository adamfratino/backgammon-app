"use client";

import { atom, useAtom, useAtomValue } from "jotai";
import { Group, Toggle, ToggleGroup } from "@uiid/design-system";
import { ChartPieIcon, TableIcon } from "@uiid/design-system/icons";

/**
 * The two halves of a category: the mistakes themselves, and what they add up
 * to. Both are narrowed by the same sidebar, so this picks which answer you are
 * looking at rather than what is being asked.
 *
 * Each carries the shape of what it draws — rows against a divided circle — so
 * the pair reads as two forms of the same figures rather than two destinations.
 */
const CATEGORY_VIEWS = [
  { id: "blunders", label: "Blunders", Icon: TableIcon },
  { id: "statistics", label: "Statistics", Icon: ChartPieIcon },
] as const;

type CategoryView = (typeof CATEGORY_VIEWS)[number]["id"];

/**
 * Which half is on screen. Client state rather than a `?view=`: every filter
 * and every sort rewrites the URL through `viewParams`, which writes only the
 * members it knows about, so a param it had not been told to carry would be
 * dropped by the next tick of the sidebar — and narrowing the statistics would
 * put you back on the blunders.
 *
 * Kept in an atom rather than in a component wrapping the page, because the
 * switch sits beside the title and the half it picks is drawn a column lower,
 * beside the filters.
 */
const categoryView = atom<CategoryView>("blunders");

/**
 * The switch, beside the category's name rather than over either half: it names
 * what the whole page is showing, and both halves answer to the same filters.
 */
export function CategoryViewToggle() {
  const [view, setView] = useAtom(categoryView);

  return (
    <ToggleGroup
      aria-label="View"
      size="xsmall"
      value={[view]}
      // A view is always set, so pressing the pressed one hands back nothing and
      // matches nothing here — which leaves the current view where it is.
      onValueChange={([next]) => {
        const picked = CATEGORY_VIEWS.find(({ id }) => id === next);
        if (picked) setView(picked.id);
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
      {CATEGORY_VIEWS.map(({ id, label, Icon }) => (
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
      ))}
    </ToggleGroup>
  );
}

/**
 * Whichever half the switch is on. The other is unmounted rather than hidden,
 * so the statistics ask the server for their figures the first time they are
 * opened instead of on every load of a page they were not on.
 */
export function CategoryViewPanel({
  blunders,
  statistics,
}: {
  blunders: React.ReactNode;
  statistics: React.ReactNode;
}) {
  const view = useAtomValue(categoryView);

  return <>{view === "statistics" ? statistics : blunders}</>;
}
