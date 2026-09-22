"use client";

import type { PaletteColor } from "@uiid/design-system";
import { Threshold } from "@microcharts/react/annotations";
import { SparkBar } from "@microcharts/react/sparkbar/interactive";

import { paletteVar } from "@/lib/constants";

import "@microcharts/react/motion";

/** A colour a bar can wear, matched to its bars by `id`. */
export interface TrendBand {
  id: string;
  color: PaletteColor;
  step: number;
}

interface TrendBarsProps {
  /** The chart's accessible name, which the hover layer carries. */
  title: string;
  series: (number | null)[];
  /** The band each bar wears, one per value in `series` and null where its value is. */
  bands: (TrendBand | null)[];
  /** Decimal places the hover readout shows a bar's value to. */
  decimals: number;
  /** Where to draw a hairline across the bars, if anywhere. */
  target?: number;
}

const TREND_WIDTH = 320;
const TREND_HEIGHT = 64;

/**
 * Bars, each one wearing the band it was handed.
 *
 * `SparkBar` fills every bar from a single `color`, so a colour per bar is
 * drawn as one chart per band stacked on top of each other: each layer is handed
 * the whole series with every bar outside its band nulled out. The library
 * treats a null as a gap and still lays out from the full array — a bar's slot
 * is its index, not its position among the values that survived — so the layers
 * line up exactly and between them draw each bar once, in its own colour.
 *
 * Every layer needs the same `domain`, since a layer left to fit its own subset
 * would scale a handful of bars against each other instead of against the
 * whole trend. `--mc-accent` is set to match each layer's own colour because
 * `SparkBar` draws the last bar it finds with the accent ink rather than with
 * `color`, and the last bar of a layer is not the last bar of the trend.
 *
 * Hover belongs to one more layer on top, holding the whole series in clear ink.
 * A band layer only steps between its own bars, since a null has no bar to land
 * on, so the pointer has to meet a chart that has every bar. The band layers
 * go unnamed, which the library takes to mean hidden and unfocusable.
 */
export function TrendBars({ title, series, bands, decimals, target }: TrendBarsProps) {
  // Matched by id rather than identity: bands handed in from the server arrive
  // as one copy per bar.
  const layers = [
    ...new Map(bands.filter((band) => band !== null).map((band) => [band.id, band])).values(),
  ];
  const shared = {
    // Anchored at zero rather than fitted, which is the difference between
    // this panel saying something and saying nothing. `mistakes` and
    // `lost` both swing better than twofold across the database where
    // `cost` swings by a third, and bars fitted to their own range would
    // draw every card at full height — the flat one would read exactly
    // like the climbing ones. A bar measured from anywhere but zero is not
    // a length anyway. Tall enough for the target, so its line is on the chart.
    domain: [0, Math.max(...series.filter((value) => value !== null), target ?? 0)],
    width: TREND_WIDTH,
    height: TREND_HEIGHT,
    label: "none",
    summary: false,
  } as const;

  return (
    <span style={{ display: "grid", width: "100%" }}>
      {layers.map((band) => (
        <SparkBar
          key={band.id}
          {...shared}
          animate
          data={series.map((value, index) => (bands[index]?.id === band.id ? value : null))}
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
        title={title}
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
      >
        {target !== undefined && <Threshold y={target} />}
      </SparkBar>
    </span>
  );
}
