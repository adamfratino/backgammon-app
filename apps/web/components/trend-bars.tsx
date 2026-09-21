import { type FormBand, FORM_BANDS, paletteVar } from "@/lib/constants";
import { SparkBar } from "@microcharts/react/sparkbar";

interface TrendBarsProps {
  label: string;
  series: number[];
  /** Each block's band, indexed alongside `series`. */
  bands: FormBand[];
  /** The newest block's band, for the accessible name. Absent on an empty series. */
  latest: FormBand | undefined;
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
 */
export function TrendBars({ label, series, bands, latest }: TrendBarsProps) {
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
            } as React.CSSProperties
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
