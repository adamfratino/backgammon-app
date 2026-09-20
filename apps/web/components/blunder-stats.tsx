"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
// The interactive build, for the hover: the static one draws the same ring
// but has nothing to say when you point at a wedge.
import { MicroDonut } from "@microcharts/react/micro-donut/interactive";
// Named for what it does here rather than what the library calls it, and so a
// reader never has to work out which of two `Progress` exports this is.
import { Progress as ShareBar } from "@microcharts/react/progress";
import { type PaletteColor, Group, Stack, Status, Text } from "@uiid/design-system";

import {
  CUBE_ERRORS,
  CUBE_PANELS,
  type CubeDirection,
  filtersFrom,
  MIN_CHART_DECISIONS,
  paletteVar,
  SEVERITY_BANDS,
  SEVERITY_COLOR,
} from "@/lib/constants";
import { useTRPC } from "@/trpc/client";

/**
 * Big enough that four wedges are still four wedges, small enough that two of
 * these fit side by side in half a column with their legends beside them.
 */
const DONUT_SIZE = 96;

/** Three times the library's own 5, which draws a ring rather than a hairline. */
const DONUT_WEIGHT = 15;

/** Wide enough to read a share off, narrow enough to sit inside a legend row. */
const SHARE_BAR_WIDTH = 64;

/** A rule's worth of height — the bar is a length, not a shape. */
const SHARE_BAR_HEIGHT = 8;

/** One line of a panel: what went wrong, how often, and what it cost. */
interface StatRow {
  id: string;
  label: string;
  color: PaletteColor;
  decisions: number;
  equityLost: number;
}

/**
 * What this category's mistakes cost, under the filters the table above is
 * already using.
 *
 * It reads the filters off the URL rather than taking them as props, the way
 * the table does, so the two can never be looking at different questions: there
 * is one address for a view, and everything on the page reads it.
 */
export function BlunderStats({ category }: { category: string }) {
  const trpc = useTRPC();

  const searchParams = useSearchParams();
  const filters = filtersFrom(searchParams);

  const { isPending, isPlaceholderData, error, data } = useQuery({
    ...trpc.blunders.stats.queryOptions({ category, ...filters }),
    placeholderData: keepPreviousData,
  });

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load stats: {error.message}</p>;

  const bands: StatRow[] = SEVERITY_BANDS.map(({ id, label }) => ({
    id,
    label,
    color: SEVERITY_COLOR[id],
    ...(data.bands[id] ?? { decisions: 0, equityLost: 0 }),
  }));

  const cubeRows = (side: CubeDirection): StatRow[] =>
    CUBE_ERRORS.filter((error) => error.side === side).map(({ id, label, color }) => ({
      id,
      label,
      color,
      ...(data.cube[id] ?? { decisions: 0, equityLost: 0 }),
    }));

  return (
    <Stack
      aria-busy={isPlaceholderData}
      style={{ opacity: isPlaceholderData ? 0.5 : 1 }}
      ax="stretch"
      gap={6}
      pt={6}
      bt={1}
    >
      <StatPanel
        title="Equity lost by error level"
        description="Where your equity goes by severity: a few catastrophes, or the steady drip of small mistakes?"
        denominator={data.decisions}
        rows={bands}
      />

      {/* One under the other, in the order the cube reaches you: what you did
          with it, then what you did when it came back. Each panel is as wide as
          the one above, so a wedge in one is the same size as a wedge in
          another and the three can be read down rather than across. */}
      {(Object.keys(CUBE_PANELS) as CubeDirection[]).map((side) => {
        const rows = cubeRows(side);
        const { title, description } = CUBE_PANELS[side];

        return (
          <StatPanel
            key={side}
            title={title}
            description={description}
            denominator={rows.reduce((sum, row) => sum + row.decisions, 0)}
            rows={rows}
          />
        );
      })}
    </Stack>
  );
}

/**
 * One statistic: what it is, what it is counted over, and the circle that
 * divides it.
 *
 * The denominator is on the panel rather than implied by it. The list above
 * shows one page of rows while these count every decision the filters leave,
 * frequently hundreds — and with nothing saying so, a summary sitting under
 * fifteen rows reads as a summary of those fifteen.
 */
function StatPanel({
  title,
  description,
  denominator,
  rows,
}: {
  title: string;
  description: string;
  denominator: number;
  rows: StatRow[];
}) {
  return (
    <Stack ax="stretch" gap={4}>
      <Stack gap={1} maxw={460}>
        <Text render={<h2 />} size={1} weight="bold">
          {title}
        </Text>
        <Text size={-1} shade="muted">
          {description} Across{" "}
          <data value={denominator}>
            {denominator.toLocaleString()} {denominator === 1 ? "decision" : "decisions"}
          </data>
          , not the page above.
        </Text>
      </Stack>

      {denominator < MIN_CHART_DECISIONS ? (
        <TooFew decisions={denominator} />
      ) : (
        <StatDonut rows={rows} />
      )}
    </Stack>
  );
}

/**
 * The rows themselves: a name in its own colour, how many decisions, what they
 * cost, and the cost drawn against the worst-paying row.
 *
 * Counts and equity side by side, because the two disagree and that
 * disagreement is the point. Across the database the 901 moderate decisions
 * give up 123.43 between them where the 81 catastrophic ones give up 45.28 —
 * the level that looks survivable one at a time is the one paying for the
 * matches. A column of counts alone is already on the Severity filter's badges,
 * and it tells the opposite story.
 *
 * Bars rather than a chart: there are a handful of rows with a name, a count
 * and a total apiece, which is a table. All the numbers need is something to be
 * read against, and a bar per row does that without turning them into a figure.
 */
/**
 * The panel's decisions as one circle, with a legend naming each wedge and what
 * it holds.
 *
 * Split by how many decisions rather than by what they cost, which is the share
 * the panel has always shown: a wedge is the same proportion the bar beside its
 * row used to be. The equity sits in the legend next to it, so the two numbers
 * stay together and the disagreement between them is still there to be read.
 *
 * Wedge colours are handed in rather than themed, so a wedge is the same hue as
 * the dot that names it — `paletteVar` names the token the palette class
 * resolves to.
 */
function StatDonut({ rows }: { rows: StatRow[] }) {
  const wedges = rows.filter(({ decisions }) => decisions > 0);
  const total = wedges.reduce((sum, row) => sum + row.decisions, 0);

  // Which wedge the pointer or the keyboard is on, as an index into `wedges` —
  // the same array the ring was handed, so the two cannot fall out of step —
  // and the share the ring itself worked out for it.
  //
  // The share comes from the chart rather than from a division here because the
  // two do not agree: microcharts rounds a composition by largest remainder so
  // its wedges sum to 100, where rounding each on its own puts Moderate at 55%
  // against the 54% the ring announces for the same wedge.
  const [active, setActive] = useState<{ index: number; share: string } | null>(null);
  const hovered = active === null ? null : (wedges[active.index] ?? null);

  return (
    <Stack ax="stretch" gap={3}>
      <Group ay="center" gap={5}>
        <MicroDonut
          data={wedges.map(({ label, decisions }) => ({ label, value: decisions }))}
          colors={wedges.map(({ color }) => paletteVar(color))}
          size={DONUT_SIZE}
          weight={DONUT_WEIGHT}
          label="none"
          // The library's own chip knows the count and nothing else; equity
          // never reaches it, so the readout below is ours.
          readout={false}
          onActive={(datum) =>
            setActive(datum === null ? null : { index: datum.index, share: datum.formatted ?? "" })
          }
        />

        {/* The numbers the circle cannot carry. A wedge says what share it is;
            how many decisions that was, and what they gave up, belong beside
            its own name rather than only in a readout you have to go looking
            for. */}
        <Stack gap={2} minw={0} style={{ flex: 1 }}>
          {wedges.map(({ id, label, color, decisions, equityLost }) => (
            <Group key={id} ay="center" ax="space-between" gap={3} fullwidth>
              <Status color={color}>{label}</Status>
              <Group ay="center" gap={3}>
                <Text size={-1} shade="muted">
                  {decisions.toLocaleString()}
                </Text>
                <Text size={-1} weight="bold">
                  {equityLost === 0 ? "\u2014" : `\u2212${equityLost.toFixed(2)}`}
                </Text>
                {/* The wedge's own length, said again where the numbers are:
                    the circle shows how the whole divides, and this shows which
                    row of the legend each division belongs to. Counted against
                    the panel's own total rather than handed a percentage, so
                    the rounding is the chart's and matches the circle. */}
                <ShareBar
                  value={decisions}
                  max={total || 1}
                  color={paletteVar(color)}
                  width={SHARE_BAR_WIDTH}
                  height={SHARE_BAR_HEIGHT}
                  label="none"
                />
              </Group>
            </Group>
          ))}
        </Stack>
      </Group>

      {/* Always here, holding its own line whether or not a wedge is under the
          pointer: a readout that appeared on hover would shift everything below
          it the moment you went looking for one. */}
      <Group ay="center" gap={3} style={{ minHeight: "1.5em" }} aria-live="polite">
        {hovered && active && (
          <>
            {/* The chart's own chip — the wedge's name, its share and how many
                decisions that was. Taken whole rather than rebuilt from the
                parts, so the figure here is the figure the ring announces. */}
            <Status color={hovered.color}>{active.share}</Status>
            <Text size={-1} weight="bold">
              {hovered.equityLost === 0
                ? "\u2014"
                : `\u2212${hovered.equityLost.toFixed(2)} equity`}
            </Text>
          </>
        )}
      </Group>
    </Stack>
  );
}

/**
 * What a panel says instead of a table of near-empty rows. Rows drawn from a
 * handful of decisions look exactly like rows drawn from hundreds, so the
 * honest thing is the count — and it sits where the table would have, so the
 * panel keeps its shape as you move between categories.
 */
function TooFew({ decisions }: { decisions: number }) {
  return (
    <Text size={-1} shade="muted">
      {decisions === 0
        ? "No decisions here to break down."
        : `Only ${decisions} ${decisions === 1 ? "decision" : "decisions"} here — too few to break down.`}
    </Text>
  );
}
