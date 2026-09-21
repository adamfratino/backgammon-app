import type { CSSProperties } from "react";
import { Delta } from "@microcharts/react/delta";
import { SparkBar } from "@microcharts/react/sparkbar";
import { Card, Group, Stack, Text } from "@uiid/design-system";

import { FORM_BANDS, type FormBand, formBandsFor, paletteVar } from "@/lib/constants";
import { caller } from "@/server/caller";
import type { FormPoint } from "@/server/router";

/**
 * The trend's aspect ratio rather than its size: the bars stretch to the card's
 * width and keep this shape, so half the page gets a strip of bars and not a
 * block of them.
 */
const TREND_WIDTH = 320;
const TREND_HEIGHT = 64;

/**
 * The two cards of the panel: how often you go wrong, and what going wrong costs.
 *
 * Equity given up per match is not among them, though it is the figure that
 * matters most — it is the product of these two, and drawn beside them it was
 * simply the first one again. Across this database it tracks mistakes per match
 * at a correlation of 0.958, because the other factor barely moves; two bars of
 * the same shape spend a card saying one thing. It is the headline above the
 * cards instead, where it costs no shape at all.
 *
 * What is left are the two that genuinely differ — they correlate at -0.257, so
 * each tells the reader something the other does not.
 *
 * `decimals` differs per card because the quantities do: mistakes per match moves
 * in hundredths where the cost of one moves in thousandths, and rounding that
 * one to two places would print the same number for every block it has.
 */
const MEASURES = [
  {
    id: "mistakes",
    label: "Mistakes per match",
    description: "The average quantity of blunders per match.",
    decimals: 2,
  },
  {
    id: "cost",
    label: "Cost of one mistake",
    description: "The average equity lost per blunder.",
    decimals: 3,
  },
] as const satisfies readonly {
  id: keyof FormPoint;
  label: string;
  description: string;
  decimals: number;
}[];

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
    <>
      {now === null ? (
        <TooShort matches={matches} window={window} />
      ) : (
        <>
          {/* <Headline value={now.lost} previous={before?.lost ?? null} count={window} /> */}
          {MEASURES.map(({ id, label, description, decimals }) => (
            <FormCard
              key={id}
              label={label}
              description={description}
              decimals={decimals}
              window={window}
              value={now[id]}
              previous={before?.[id] ?? null}
              series={points.map((point) => point[id])}
            />
          ))}
        </>
      )}
    </>
  );
}

/**
 * What the mistakes cost, as one figure rather than a row of bars.
 *
 * This is the number the panel is really about, and it is the two cards below
 * multiplied together — so it gets the size, and they get the shapes.
 */
function Headline({
  value,
  previous,
  count,
}: {
  value: number;
  previous: number | null;
  count: number;
}) {
  return (
    <Group ay="baseline" gap={3}>
      <Text size={3} weight="bold">
        <data value={value}>{value.toFixed(2)}</data> equity given up per match, over last {count}{" "}
        matches
      </Text>
      {previous !== null && <Delta value={value} from={previous} positive="down" />}
    </Group>
  );
}

interface FormCardProps {
  label: string;
  description: string;
  decimals: number;
  window: number;
  value: number;
  /** The window before this one, or null when there has not been a second yet. */
  previous: number | null;
  series: number[];
}

function FormCard({
  label,
  description,
  decimals,
  window,
  value,
  previous,
  series,
}: FormCardProps) {
  // Ranked against the blocks actually drawn beside it rather than against every
  // match ever played, so a reader can check a bar's colour against the bars it
  // sits among.
  const bands = formBandsFor(series);
  const latest = bands[bands.length - 1];

  return (
    <Card
      title={label}
      description={description}
      footer={
        // One `Text` around the whole sentence, because the footer is a flex row
        // and would otherwise lay the value, the chip and the words out as
        // separate items, dropping the spaces between them.
        <Text>
          <Text weight="bold">
            <data value={value}>{value.toFixed(decimals)}</data>
          </Text>{" "}
          now
          {previous !== null && (
            <>
              ,{" "}
              {/* Every measure here counts something that went wrong, so down is
                  the good direction on both — which is the one thing `Delta`
                  needs told, since it colours by valence and not by sign. */}
              <Delta value={value} from={previous} positive="down" /> against the previous {window}
            </>
          )}
        </Text>
      }
    >
      <TrendBars label={label} series={series} bands={bands} latest={latest} />
    </Card>
  );
}

interface TrendBarsProps {
  label: string;
  series: number[];
  /** Each block's band, indexed alongside `series`. */
  bands: FormBand[];
  /** The newest block's band, for the accessible name. Absent on an empty series. */
  latest: FormBand | undefined;
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
 * whole trend. `--mc-accent` is set to match each layer's own colour because
 * `SparkBar` draws the last bar it finds with the accent ink rather than with
 * `color`, and the last bar of a layer is not the last block of the trend.
 */
function TrendBars({ label, series, bands, latest }: TrendBarsProps) {
  const domain = [0, Math.max(...series)] as const;

  return (
    <span
      role="img"
      aria-label={`${label}, ${series.length} blocks${latest ? `, latest ${latest.label}` : ""}`}
      style={{ display: "grid", width: "100%" }}
    >
      {FORM_BANDS.map((band) => (
        <SparkBar
          key={band.id}
          data={series.map((value, index) => (bands[index] === band ? value : null))}
          // Anchored at zero rather than fitted, which is the difference between
          // this panel saying something and saying nothing. `mistakes` and
          // `lost` both swing better than twofold across the database where
          // `cost` swings by a third, and bars fitted to their own range would
          // draw every card at full height — the flat one would read exactly
          // like the climbing ones. A bar measured from anywhere but zero is not
          // a length anyway.
          domain={domain}
          color={paletteVar(band.color, band.step)}
          style={
            {
              gridArea: "1 / 1",
              width: "100%",
              "--mc-accent": paletteVar(band.color, band.step),
            } as CSSProperties
          }
          width={TREND_WIDTH}
          height={TREND_HEIGHT}
          label="none"
          // The name is on the wrapper: four layers each announcing themselves
          // would read the trend out four times over.
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
