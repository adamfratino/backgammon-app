"use client";

import { FORM_BANDS, formBandsFor, paletteVar } from "@/lib/constants";
import { SparkBar } from "@microcharts/react/sparkbar/interactive";

import "@microcharts/react/motion";

interface TrendBarsProps {
  label: string;
  series: number[];
  /** Decimal places the hover readout shows a block's value to. */
  decimals: number;
}

const TREND_WIDTH = 320;
const TREND_HEIGHT = 64;

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
 *
 * Hover belongs to one more layer on top, holding the whole series in clear ink.
 * A band layer only steps between its own bars, since a null has no bar to land
 * on, so the pointer has to meet a chart that has every block. The band layers
 * go unnamed, which the library takes to mean hidden and unfocusable.
 */
export function TrendBars({ label, series, decimals }: TrendBarsProps) {
  // Ranked against the blocks actually drawn beside it rather than against every
  // match ever played, so a reader can check a bar's colour against the bars it
  // sits among. Worked out here rather than handed in from the server, since the
  // layers match a block to its band by identity and a band that crossed from
  // the server would arrive as a copy.
  const bands = formBandsFor(series);
  const latest = bands[bands.length - 1];
  const shared = {
    // Anchored at zero rather than fitted, which is the difference between
    // this panel saying something and saying nothing. `mistakes` and
    // `lost` both swing better than twofold across the database where
    // `cost` swings by a third, and bars fitted to their own range would
    // draw every card at full height — the flat one would read exactly
    // like the climbing ones. A bar measured from anywhere but zero is not
    // a length anyway.
    domain: [0, Math.max(...series)],
    width: TREND_WIDTH,
    height: TREND_HEIGHT,
    label: "none",
    summary: false,
  } as const;

  return (
    <span style={{ display: "grid", width: "100%" }}>
      {FORM_BANDS.map((band) => (
        <SparkBar
          key={band.id}
          {...shared}
          animate
          data={series.map((value, index) => (bands[index] === band ? value : null))}
          color={paletteVar(band.color, band.step)}
          style={
            {
              gridArea: "1 / 1",
              width: "100%",
              "--mc-accent": paletteVar(band.color, band.step),
            } as React.CSSProperties
          }
        />
      ))}
      <SparkBar
        {...shared}
        data={series}
        title={`${label}, ${series.length} blocks${latest ? `, latest ${latest.label}` : ""}`}
        format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }}
        color="transparent"
        // The accent is cleared for the last bar's sake, and the hover outline
        // takes its colour from the accent unless told otherwise.
        style={
          {
            gridArea: "1 / 1",
            width: "100%",
            "--mc-accent": "transparent",
            "--mc-active-stroke": "var(--mc-stroke)",
          } as React.CSSProperties
        }
      />
    </span>
  );
}
