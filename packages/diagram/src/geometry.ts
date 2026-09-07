/**
 * The diagram's coordinate system, in board units.
 *
 * One unit is a tenth of a point's width, so the whole drawing is described in
 * board terms rather than in pixels — the `viewBox` carries the geometry and
 * the rendered size is left entirely to CSS.
 *
 * Unlike a shuffleboard court these numbers are not a physical specification;
 * a backgammon board has no regulation proportions worth encoding. They are
 * drawing choices, which is why they live here and not in `@repo/core`.
 *
 * Left to right: the cube lane, the playing surface split by the bar, then the
 * bear-off tray.
 */

export const POINT_WIDTH = 10;
export const POINTS_PER_QUADRANT = 6;
export const QUADRANT_WIDTH = POINT_WIDTH * POINTS_PER_QUADRANT;

/** How far a point reaches toward the middle. Exactly five stacked checkers. */
export const POINT_HEIGHT = 44;

/** Clear space between the tips of opposing points, where the dice sit. */
export const GUTTER = 12;

export const BAR_WIDTH = 10;
export const TRAY_WIDTH = 12;
export const CUBE_LANE_WIDTH = 12;

/** The wooden surround, which also carries the point numbers. */
export const FRAME = 7;

export const CHECKER_RADIUS = 4.4;

/** A borne-off checker lies flat in the tray: a thin bar rather than a disc. */
export const OFF_HEIGHT = 2.6;
export const OFF_PITCH = 3;

export const CUBE_SIZE = 10;
export const DIE_SIZE = 9;
export const DIE_GAP = 3;

export const PLAY_WIDTH = QUADRANT_WIDTH * 2 + BAR_WIDTH;
export const PLAY_HEIGHT = POINT_HEIGHT * 2 + GUTTER;

export const CUBE_LANE_LEFT = FRAME;
export const PLAY_LEFT = FRAME + CUBE_LANE_WIDTH + FRAME;

/** Edges of the playing surface. */
export const TOP = FRAME;
export const BOTTOM = FRAME + PLAY_HEIGHT;
export const MIDDLE = FRAME + PLAY_HEIGHT / 2;

export const BAR_LEFT = PLAY_LEFT + QUADRANT_WIDTH;
export const BAR_CENTRE = BAR_LEFT + BAR_WIDTH / 2;

export const TRAY_LEFT = PLAY_LEFT + PLAY_WIDTH + FRAME;

export const WIDTH = TRAY_LEFT + TRAY_WIDTH + FRAME;
export const HEIGHT = FRAME + PLAY_HEIGHT + FRAME;

/**
 * Middle of each half. The dice are thrown into the half holding the roller's
 * home board — the right for the near side, the left for the far side.
 */
export const NEAR_HALF_CENTRE = BAR_LEFT + BAR_WIDTH + QUADRANT_WIDTH / 2;
export const FAR_HALF_CENTRE = PLAY_LEFT + QUADRANT_WIDTH / 2;

/** Columns run 0-11 left to right, skipping over the bar between 5 and 6. */
export const COLUMNS = POINTS_PER_QUADRANT * 2;

export function columnX(column: number): number {
  const offset = column < POINTS_PER_QUADRANT ? PLAY_LEFT : BAR_LEFT + BAR_WIDTH - QUADRANT_WIDTH;
  return offset + column * POINT_WIDTH;
}

export const columnCentre = (column: number): number => columnX(column) + POINT_WIDTH / 2;

/**
 * The point each column shows, in the near side's own numbering.
 *
 * The near side bears off at the bottom right and travels anticlockwise, so
 * the bottom row falls 12→1 from left to right and the top row climbs 13→24.
 */
export const bottomPoint = (column: number): number => COLUMNS - column;
export const topPoint = (column: number): number => COLUMNS + 1 + column;
