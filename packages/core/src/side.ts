import { BAR_PIP, CHECKERS_PER_SIDE, POINT_COUNT } from "./constants.ts";
import type { Side } from "./types.ts";

/** A side with nothing on the board. `points` is 1-indexed, so it needs 25 slots. */
export function emptySide(): Side {
  return { points: new Array<number>(POINT_COUNT + 1).fill(0), bar: 0, off: 0 };
}

/**
 * Checkers on a point. Reading through this keeps `noUncheckedIndexedAccess`
 * honest at the one place it matters instead of at every call site.
 */
export function checkersOn(side: Side, point: number): number {
  return side.points[point] ?? 0;
}

/** Checkers sitting on a point — everything except the bar and the ones borne off. */
export function checkersOnBoard(side: Side): number {
  let total = 0;
  for (let point = 1; point <= POINT_COUNT; point++) total += checkersOn(side, point);
  return total;
}

/**
 * Borne-off checkers. No notation records these directly: they are whatever is
 * left of the fifteen once the board and the bar are accounted for.
 */
export function bearOffCount(side: Side): number {
  return CHECKERS_PER_SIDE - checkersOnBoard(side) - side.bar;
}

/**
 * Pips left to bear off every checker. A checker on the bar is furthest of all
 * at `BAR_PIP`; borne-off checkers cost nothing. This is the raw race number —
 * the first thing to look at in a position with no contact left.
 */
export function pipCount(side: Side): number {
  let pips = side.bar * BAR_PIP;
  for (let point = 1; point <= POINT_COUNT; point++) pips += point * checkersOn(side, point);
  return pips;
}
