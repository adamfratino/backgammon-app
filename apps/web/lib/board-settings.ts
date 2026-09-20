/**
 * How the board is drawn — which way round it faces, whether it shows its pip
 * counts — is a reading preference, and each one rides in a cookie so the
 * server can honour it. The board is rendered on the server; a preference kept
 * anywhere the server cannot read — `localStorage`, say — would paint the
 * board one way and then correct itself a beat later, on every blunder in the
 * list, which is the one thing a view setting must not do.
 */

/** A year. The settings are worth keeping, and nothing here is worth keeping forever. */
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Records a choice for the next server render. Browser-only. */
function remember(cookie: string, value: string): void {
  document.cookie = `${cookie}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

export const PIP_COUNTS_COOKIE = "pip-counts";

/** Shown unless the cookie says otherwise, so a first visit gets the counts. */
export function pipCountsFrom(value: string | undefined): boolean {
  return value !== "hidden";
}

export function rememberPipCounts(shown: boolean): void {
  remember(PIP_COUNTS_COOKIE, shown ? "shown" : "hidden");
}

export const FLIP_BOARD_COOKIE = "flip-board";

/**
 * Unflipped unless the cookie says so, which puts the near side's home board
 * and its tray on the right — the way the diagram draws a board unasked.
 */
export function flipBoardFrom(value: string | undefined): boolean {
  return value === "flipped";
}

export function rememberFlipBoard(flipped: boolean): void {
  remember(FLIP_BOARD_COOKIE, flipped ? "flipped" : "normal");
}
