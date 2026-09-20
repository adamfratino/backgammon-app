/**
 * Whether the board draws its pip counts is a reading preference, and it rides
 * in a cookie so the server can honour it. The board is rendered on the server;
 * a preference kept anywhere the server cannot read — `localStorage`, say —
 * would paint the counts and then snatch them away once the browser caught up,
 * which is the one thing a "hide the pip counts" setting must not do.
 */
export const PIP_COUNTS_COOKIE = "pip-counts";

/** Shown unless the cookie says otherwise, so a first visit gets the counts. */
export function pipCountsFrom(value: string | undefined): boolean {
  return value !== "hidden";
}

/** A year. The setting is worth keeping, and nothing here is worth keeping forever. */
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Records the choice for the next server render. Browser-only. */
export function rememberPipCounts(shown: boolean): void {
  const value = shown ? "shown" : "hidden";
  document.cookie = `${PIP_COUNTS_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}
