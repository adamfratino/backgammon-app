import { caller } from "@/server/caller";

import { LeaksCard } from "./leaks-card";

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

  return <LeaksCard leaks={leaks} />;
}
