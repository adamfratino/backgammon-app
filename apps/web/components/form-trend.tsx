import type { CSSProperties } from "react";
import { Delta } from "@microcharts/react/delta";
import { SparkBar } from "@microcharts/react/sparkbar";
import {
  Stack,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRoot,
  TableRow,
  Text,
} from "@uiid/design-system";

import { FORM_BANDS, type FormBand, formBandOf, paletteVar } from "@/lib/constants";
import { caller } from "@/server/caller";
import type { FormPoint } from "@/server/router";

/** Wide enough that every block gets a readable bar, narrow enough to sit in a cell. */
const TREND_WIDTH = 220;

/** A line's worth of height — the row is a table row, not a chart panel. */
const TREND_HEIGHT = 28;

/**
 * One line of the panel: a measure, how it is written, and which way is good.
 *
 * The product comes first and its two factors under it, because the panel's
 * whole point is that the three disagree about what has been happening. Reading
 * down, the first row is the second times the third.
 *
 * `decimals` differs per row because the quantities do: equity per match moves
 * in hundredths where the cost of one mistake moves in thousandths, and rounding
 * that one to two places would print the same number for every window it has.
 */
const MEASURES = [
  {
    id: "lost",
    label: "Equity given up per match",
    decimals: 2,
  },
  {
    id: "mistakes",
    label: "Mistakes per match",
    decimals: 2,
  },
  {
    id: "cost",
    label: "Cost of one mistake",
    decimals: 3,
  },
] as const satisfies readonly { id: keyof FormPoint; label: string; decimals: number }[];

/**
 * How you have been playing lately, against how you were playing before.
 *
 * A server component with no filters to read: the sidebar narrows a category,
 * and this is the page with no category to narrow. That also keeps every block
 * out of the payload — the numbers become bars here and never travel as data.
 */
export async function FormTrend() {
  const { window, matches, points, now, before } = await caller.overall.form();

  return (
    <Stack ax="stretch" gap={4}>
      <Stack gap={1} maxw={560}>
        <Text render={<h2 />} size={1} weight="bold">
          Form over your last {window} matches
        </Text>
        <Text size={-1} shade="muted">
          One bar per {window} matches played, across{" "}
          <data value={matches}>{matches.toLocaleString()} matches</data> — blocks rather than days,
          because a day here is anything from a single match to a whole session. Newest on the
          right. The first line is the two under it multiplied together.
        </Text>
      </Stack>

      {now === null ? (
        <TooShort matches={matches} window={window} />
      ) : (
        <TableContainer>
          <TableRoot striped>
            <TableHeader>
              <TableRow>
                <TableHead>Measure</TableHead>
                <TableHead>Now</TableHead>
                <TableHead>vs previous {window}</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MEASURES.map(({ id, label, decimals }) => (
                <FormRow
                  key={id}
                  label={label}
                  decimals={decimals}
                  value={now[id]}
                  previous={before?.[id] ?? null}
                  series={points.map((point) => point[id])}
                />
              ))}
            </TableBody>
          </TableRoot>
        </TableContainer>
      )}
    </Stack>
  );
}

interface FormRowProps {
  label: string;
  decimals: number;
  value: number;
  /** The window before this one, or null when there has not been a second yet. */
  previous: number | null;
  series: number[];
}

function FormRow({ label, decimals, value, previous, series }: FormRowProps) {
  // Against the blocks actually drawn beside it rather than against every match
  // ever played, so the bar is warm or cool relative to the same record the row
  // is showing — a reader can check the colour against the bars.
  const average = series.reduce((sum, point) => sum + point, 0) / (series.length || 1);
  const bands = series.map((point) => formBandOf(point, average));
  const band = formBandOf(value, average);

  return (
    <TableRow>
      <TableCell>
        <Text size={-1}>{label}</Text>
      </TableCell>
      <TableCell>
        <Text size={-1} weight="bold">
          <data value={value}>{value.toFixed(decimals)}</data>
        </Text>
      </TableCell>
      <TableCell>
        {previous === null ? (
          <Text size={-1} shade="muted">
            {"—"}
          </Text>
        ) : (
          // Every measure here counts something that went wrong, so down is the
          // good direction on all three — which is the one thing `Delta` needs
          // told, since it colours by valence and not by sign.
          <Delta value={value} from={previous} positive="down" />
        )}
      </TableCell>
      <TableCell>
        <TrendBars label={label} series={series} bands={bands} latest={band} />
      </TableCell>
    </TableRow>
  );
}

interface TrendBarsProps {
  label: string;
  series: number[];
  /** Each block's band, indexed alongside `series`. */
  bands: FormBand[];
  /** The newest block's band, for the accessible name. */
  latest: FormBand;
}

/**
 * The blocks as bars, each one wearing how it compares with your own average.
 *
 * `SparkBar` fills every bar from a single `color`, so a temperature per bar is
 * drawn as one chart per band stacked on top of each other: each layer is handed
 * the whole series with every block outside its band nulled out. The library
 * treats a null as a gap and still lays out from the full array — a bar's slot
 * is its index, not its position among the values that survived — so the layers
 * line up exactly and between them draw each block once, in its own colour.
 *
 * Every layer needs the same `domain`, since a layer left to fit its own subset
 * would scale a handful of blocks against each other instead of against the
 * row. `--mc-accent` is set to match each layer's own colour because `SparkBar`
 * draws the last bar it finds with the accent ink rather than with `color`, and
 * the last bar of a layer is not the last block of the row.
 */
function TrendBars({ label, series, bands, latest }: TrendBarsProps) {
  const domain = [0, Math.max(...series)] as const;

  return (
    <span
      role="img"
      aria-label={`${label}, ${series.length} blocks, latest ${latest.label}`}
      style={{ display: "grid", width: TREND_WIDTH, height: TREND_HEIGHT }}
    >
      {FORM_BANDS.map((band) => (
        <SparkBar
          key={band.id}
          data={series.map((value, index) => (bands[index] === band ? value : null))}
          // Anchored at zero rather than fitted, which is the difference between
          // this panel saying something and saying nothing. `mistakes` and
          // `lost` both swing better than twofold across the database where
          // `cost` swings by a third, and bars fitted to their own range would
          // draw all three rows at full height — the flat one would read exactly
          // like the climbing ones. A bar measured from anywhere but zero is not
          // a length anyway.
          domain={domain}
          color={paletteVar(band.color)}
          style={
            {
              gridArea: "1 / 1",
              "--mc-accent": paletteVar(band.color),
            } as CSSProperties
          }
          width={TREND_WIDTH}
          height={TREND_HEIGHT}
          label="none"
          // The name is on the wrapper: four layers each announcing themselves
          // would read the row out four times over.
          summary={false}
        />
      ))}
    </span>
  );
}

/**
 * What the panel says before there is a block to draw. A bar covers a full
 * window of matches, so a freshly scraped database has matches but no bars — and
 * the honest thing is to say how many more it wants.
 */
function TooShort({ matches, window }: { matches: number; window: number }) {
  return (
    <Text size={-1} shade="muted">
      {matches === 0
        ? "No matches yet."
        : `Only ${matches} ${matches === 1 ? "match" : "matches"} so far — a first bar needs ${window}.`}
    </Text>
  );
}
