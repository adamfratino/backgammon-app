import Link from "next/link";
// Named for what it does here rather than what the library calls it, the same
// way the statistics panel names its own.
import { SegmentedBar as ShareBar } from "@microcharts/react/segmented-bar";
import { Card, Group, List, ListItem, Stack, Text } from "@uiid/design-system";

import { categoryLabel, leakRamp } from "@/lib/constants";
import { caller } from "@/server/caller";
import type { Leak } from "@/server/router";

/**
 * An aspect ratio rather than a size: the bar stretches to the card and keeps
 * its shape, a rule across the top of it at around sixty pixels tall.
 *
 * Taller in ratio than it looks, because the height follows the width: inside a
 * card the bar is the page less the card's padding, and the proportions that
 * drew sixty pixels across the whole page drew fifty-six across that.
 */
const SHARE_WIDTH = 320;
const SHARE_HEIGHT = 20;

/**
 * Where your equity actually goes, by category, across every match.
 *
 * The sidebar already counts these. What it cannot say is which of them costs
 * you anything: a count treats a 0.13 and a 0.45 as one mistake each, and the
 * two orders are not the same order.
 *
 * One card, because it is one composition read twice: the bar is the shape of
 * the split — two categories are half of everything you give up, which is the
 * fact a column of seventeen numbers buried — and the list under it names every
 * segment and carries its figures.
 */
export async function Leaks() {
  const leaks = await caller.overall.leaks();

  const equityLost = leaks.reduce((sum, leak) => sum + leak.equityLost, 0);

  // Worst first out of the query, which the bar and the list under it both read
  // in that one order.
  const data = leaks.map((leak) => ({
    label: categoryLabel(leak.category),
    value: leak.equityLost,
  }));
  const colors = leakRamp(leaks.length);

  return (
    <Card
      title="Where the equity goes"
      // An `h2` rather than the `h3` a card titles itself with: this is a panel
      // of the page rather than a card among cards, and the only heading under
      // the page's own.
      TitleProps={{ render: <h2 /> }}
      description="Ranked by what each category has cost in total, not by how often you go wrong there."
    >
      {leaks.length === 0 ? (
        <Text size={-1} shade="muted">
          No blunders yet.
        </Text>
      ) : (
        // `fullwidth` because a card's inner container does not stretch what it
        // holds: without it this stack is as wide as its widest line, and the
        // bar — which takes its width from its parent and its height from its
        // width — comes out both narrow and short.
        <Stack ax="stretch" gap={4} mt={2} fullwidth>
          {/* Every category, however many there are: the rollup this chart does
              unasked keeps five and calls the rest "Other", and "Other" here
              would be a third of your equity with no name on it. */}
          <ShareBar
            data={data}
            maxSegments={leaks.length}
            // The query ranked them, so ordering again would only risk
            // disagreeing with the list.
            order="data"
            colors={colors}
            // No percentages inside the segments: only the widest two or three
            // can seat one, so the label says nothing about the tail it drops
            // out of — and the list below carries every figure anyway.
            label="none"
            width={SHARE_WIDTH}
            height={SHARE_HEIGHT}
            style={{ width: "100%" }}
          />

          <Legend leaks={leaks} colors={colors} total={equityLost} />
        </Stack>
      )}
    </Card>
  );
}

interface LegendProps {
  leaks: Leak[];
  /** One per leak, in the same order — the colour that leak wears in the bar. */
  colors: string[];
  /** Every category's equity added up, which each line's share is taken of. */
  total: number;
}

/**
 * Which segment is which, and what each one is worth.
 *
 * A small list rather than the five-column table this replaced: the bar above it
 * already ranks them, so a line only has to name its segment and carry the three
 * figures worth keeping.
 */
function Legend({ leaks, colors, total }: LegendProps) {
  return (
    <List marker="none" gap={2} fullwidth>
      {leaks.map((leak, index) => (
        <LeakLine key={leak.category} leak={leak} color={colors[index]!} total={total} />
      ))}
    </List>
  );
}

interface LeakLineProps {
  leak: Leak;
  color: string;
  total: number;
}

function LeakLine({ leak: { category, equityLost, perDecision }, color, total }: LeakLineProps) {
  return (
    // A list item lays its children out apart, so the name takes the left and
    // the figures the right with nothing here having to place them.
    <ListItem ay="center">
      <Group ay="center" gap={2}>
        {/* The tie back to the bar, and the whole of what a swatch does.
            `aria-hidden` because it says "this line is that segment" to a reader
            who can see both, and nothing at all to one who cannot. */}
        <span
          aria-hidden
          style={{ background: color, borderRadius: 2, height: "0.625rem", width: "0.625rem" }}
        />
        {/* Straight to the category, carrying nothing: this page holds no
            filters and no sort for a link to take with it. */}
        <Link href={`/${category}`}>
          <Text size={-1}>{categoryLabel(category)}</Text>
        </Link>
      </Group>
      <Group ay="baseline" gap={3}>
        <Text size={-1}>{share(equityLost, total)}</Text>
        <Text size={-1} weight="bold">
          <data value={equityLost}>{`−${equityLost.toFixed(1)}`}</data>
        </Text>
        <Text size={-1} shade="muted">
          <data value={perDecision}>{perDecision.toFixed(3)}</data> each
        </Text>
      </Group>
    </ListItem>
  );
}

/**
 * A category's cut of the total, to a tenth of a percent.
 *
 * Whole percents would print the bottom four categories as 2%, 1%, 1% and 0% —
 * and a line that says a category costs you nothing is the one thing the number
 * is there to disprove.
 */
function share(equityLost: number, total: number): string {
  return total === 0 ? "0%" : `${((equityLost / total) * 100).toFixed(1)}%`;
}
