import { Delta } from "@microcharts/react/delta";
import { Group, Text } from "@uiid/design-system";

import { formBandsFor } from "@/lib/constants";
import { caller } from "@/server/caller";
import type { FormPoint } from "@/server/router";

import { FormCard } from "./form-card";
import { TrendBars } from "./trend-bars";

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
 * and this is the page with no category to narrow.
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
          {MEASURES.map(({ id, label, description, decimals }) => {
            const series = points.map((point) => point[id]);
            // Ranked against the blocks actually drawn beside it rather than
            // against every match ever played, so a reader can check a bar's
            // colour against the bars it sits among.
            const bands = formBandsFor(series);
            const latest = bands.at(-1);

            return (
              <FormCard
                key={id}
                label={label}
                description={description}
                decimals={decimals}
                window={window}
                value={now[id]}
                previous={before?.[id] ?? null}
              >
                <TrendBars
                  title={`${label}, ${series.length} blocks${latest ? `, latest ${latest.label}` : ""}`}
                  series={series}
                  bands={bands}
                  decimals={decimals}
                />
              </FormCard>
            );
          })}
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
