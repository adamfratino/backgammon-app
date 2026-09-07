/** Points on a backgammon board. Each side numbers them 1-24 from its own home. */
export const POINT_COUNT = 24;

/** Checkers each side owns, wherever they are: on a point, on the bar, or off. */
export const CHECKERS_PER_SIDE = 15;

/** A side's home board is its points 1-6 — the quadrant it bears off from. */
export const HOME_BOARD_SIZE = 6;

/**
 * What a checker on the bar costs in pips. It re-enters on the opponent's home
 * board, which is a full board-length of 24 points plus the entry itself away.
 */
export const BAR_PIP = 25;
