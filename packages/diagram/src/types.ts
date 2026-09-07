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

  /** Which side is on roll, which decides where the dice land. Defaults to the near side. */
  turn?: SideName;

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
