import type { Cube, Position, SideName } from "@repo/core";

export interface BoardProps {
  /**
   * The checkers to draw. `position.player` is the near side, along the
   * bottom; `position.opponent` is the far side, counting from the other end.
   */
  position: Position;

  /**
   * The roll being played. Drawn in the half holding the roller's home board.
   * `null` — a cube decision, taken before the dice are thrown — draws none.
   */
  dice?: [number, number] | null;

  /**
   * The doubling cube. Drawn in the lane down the left, at the owner's end or
   * centred when nobody owns it. A cube still at 1 and centred has not been
   * turned, so it is left out rather than drawn with a value no real cube has.
   */
  cube?: Cube | null;

  /**
   * Which side is on roll, which decides where the dice land and whose
   * checkers `move` refers to. Defaults to the near side.
   */
  turn?: SideName;

  /**
   * A play to draw as arrows, in the notation GNU BG and XG write — `13/9 6/5*`,
   * `bar/22*\/17`, `3/off(2)` — numbered from the side on roll's own home
   * board. Each checker's arrow leaves the top of its stack and ends where it
   * would stand. `null`, or a string that isn't a play, draws none.
   */
  move?: string | null;

  /**
   * Each side's pip count, shown in the frame at its own end of the tray — the
   * near side's below it, the far side's above — on a chip in that side's
   * checker colours. The diagram draws the numbers it is given rather than
   * counting them; `pipCount` from `@repo/core` gives the raw race count.
   * `null` draws none, and leaves them out of the diagram's accessible name
   * too — a hidden count that a screen reader still reads out is not hidden.
   */
  pipCounts?: Record<SideName, number> | null;

  /**
   * Applied to the root `<svg>`. The diagram has no intrinsic size — it fills
   * whatever box it is given — and every part of it carries a `gammon-`
   * prefixed class, so this is the hook for overriding size and colours.
   *
   * @example
   *   .my-board .gammon-point--dark { fill: var(--point-dark); }
   */
  className?: string;

  /** Point numbers in the frame, in the near side's numbering. Defaults to `true`. */
  showNumbers?: boolean;
}
