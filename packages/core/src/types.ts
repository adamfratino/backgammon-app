/**
 * One side's checkers, numbered from that side's own home board: point 1 is
 * the one it bears off from and point 24 the one furthest away. Both sides of
 * a position are described this way, so each reads from its own perspective
 * and neither has to be mentally flipped.
 */
export interface Side {
  /** `points[n]` holds the checkers on point `n`, for `n` in 1-24. Index 0 is unused. */
  points: number[];
  /** Checkers hit and waiting to re-enter. */
  bar: number;
  /** Checkers borne off. */
  off: number;
}

/**
 * A checker layout. The names follow the XGID board string, which writes one
 * side in upper case and the other in lower: `player` is the upper-case side,
 * the one XG draws nearest the viewer. Which side is *on roll* is a separate
 * fact — see `Xgid["turn"]`.
 */
export interface Position {
  player: Side;
  opponent: Side;
}

/** Which side of a `Position` something refers to. */
export type SideName = "player" | "opponent";
