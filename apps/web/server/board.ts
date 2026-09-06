import { decodePositionId } from "@repo/galaxy-scraper/position";

const CHECKERS_PER_SIDE = 15;

export interface BoardSide {
  bar: number;
  off: number;
  /** Occupied points as `point:checkers`, from the 24 point down to the 1. */
  points: string;
}

export interface BoardPosition {
  onRoll: BoardSide;
  opponent: BoardSide;
}

/**
 * One side's checkers, listed in the direction they travel. `Board[player]`
 * indexes 0-23 as that player's points 1-24 and 24 as its bar, so each side is
 * numbered from its own home board.
 */
function summarizeSide(points: number[]): BoardSide {
  const bar = points[24] ?? 0;
  const held: string[] = [];
  let onBoard = 0;

  for (let point = 24; point >= 1; point--) {
    const count = points[point - 1] ?? 0;
    if (count === 0) continue;
    held.push(`${point}:${count}`);
    onBoard += count;
  }

  return { bar, off: CHECKERS_PER_SIDE - onBoard - bar, points: held.join(" ") || "none" };
}

/**
 * The checker layout of the position a blunder was made in.
 *
 * gnubg encodes the player on roll as `board[1]`. Both halves of that are
 * checked against the scraped data: the decode reproduces the stored
 * `source_xgid` board string on every row, and on `bar/…` plays it is
 * `board[1]` that holds the barred checker.
 */
export function describeBoard(positionId: string | null): BoardPosition | null {
  if (!positionId) return null;

  const board = decodePositionId(positionId);
  return { onRoll: summarizeSide(board[1]), opponent: summarizeSide(board[0]) };
}
