import { Text } from "@uiid/design-system";

import { TARGET_ER, targetBandOf } from "@/lib/constants";
import { caller } from "@/server/caller";

import { FormCard } from "./form-card";
import { TrendBars } from "./trend-bars";

/**
 * Your ER in each of your latest matches, coloured against the target the match
 * list's badges use, with a line at the target itself.
 */
export async function ErTrend() {
  const { window, series, now, before } = await caller.overall.er();

  if (now === null) {
    return (
      <Text size={-1} shade="muted">
        No matches with an ER yet.
      </Text>
    );
  }

  const latest = series.at(-1);

  return (
    <FormCard
      label="Error rate"
      description={`Your ER in each of your last ${window} matches. The line is your target of ${TARGET_ER}.`}
      decimals={1}
      window={window}
      value={now}
      previous={before}
    >
      <TrendBars
        title={`Error rate, ${series.length} matches${latest != null ? `, latest ${latest.toFixed(1)}` : ""}`}
        series={series}
        bands={series.map((er) => (er === null ? null : targetBandOf(er, TARGET_ER, 1)))}
        decimals={1}
        target={TARGET_ER}
      />
    </FormCard>
  );
}
