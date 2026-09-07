import { POINT_COUNT } from "./constants.ts";
import { bearOffCount, emptySide } from "./side.ts";
import type { Position, Side, SideName } from "./types.ts";

/** The board field: a bar, 24 points, then the other bar. */
const BOARD_LENGTH = POINT_COUNT + 2;

const PREFIX = "XGID=";

export interface Cube {
  /** 1, 2, 4, 8 … — the stake, not the exponent the string stores. */
  value: number;
  /** Who owns it, or `null` when it is still centred. */
  owner: SideName | null;
}

export interface Xgid {
  position: Position;
  cube: Cube;
  /** The roll being played, or `null` on a cube decision, where no dice are thrown yet. */
  dice: [number, number] | null;
  /** Match score, keyed the same way as the position. */
  scores: Record<SideName, number>;
  /** 0 for an unlimited (money) game. */
  matchLength: number;
  crawford: boolean;
  /** The side to play. Not always `player`: either side can be on roll. */
  turn: SideName;
}

/**
 * Checkers a board character stands for. `A`-`O` and `a`-`o` count 1-15; `-`
 * is an empty point, and anything else is treated as empty too.
 */
function checkerCount(char: string): number {
  if (char >= "A" && char <= "O") return char.charCodeAt(0) - 64;
  if (char >= "a" && char <= "o") return char.charCodeAt(0) - 96;
  return 0;
}

const isUpperCase = (char: string): boolean => char >= "A" && char <= "O";

/**
 * The 26-character board field.
 *
 * Index 0 is the lower-case side's bar and index 25 the upper-case side's.
 * Between them, index `i` is the *upper-case* side's point `i` — so the same
 * index is the lower-case side's point `25 - i`, since the two number the
 * board from opposite ends. Reading it that way lands both sides in their own
 * numbering, which is what `Side` promises.
 */
function parseBoard(board: string): Position | null {
  if (board.length !== BOARD_LENGTH) return null;

  const player = emptySide();
  const opponent = emptySide();

  player.bar = checkerCount(board[BOARD_LENGTH - 1] ?? "");
  opponent.bar = checkerCount(board[0] ?? "");

  for (let index = 1; index <= POINT_COUNT; index++) {
    const char = board[index] ?? "";
    const count = checkerCount(char);
    if (count === 0) continue;

    if (isUpperCase(char)) player.points[index] = count;
    else opponent.points[POINT_COUNT + 1 - index] = count;
  }

  for (const side of [player, opponent] satisfies Side[]) {
    side.off = bearOffCount(side);
    // A string can claim more than fifteen checkers a side. Rendering a
    // negative stack is worse than clamping it, and the caller still sees a
    // position it can draw.
    if (side.off < 0) side.off = 0;
  }

  return { player, opponent };
}

/** `"53"` is a 5-3; `"00"` means the dice have not been thrown. */
function parseDice(field: string): [number, number] | null {
  if (field.length !== 2) return null;
  const first = Number(field[0]);
  const second = Number(field[1]);
  if (!first || !second) return null;
  return [first, second];
}

/**
 * Parses an XGID into the position it describes, or `null` if the string is
 * not one. Fields after the board are, in order: cube exponent, cube position,
 * turn, dice, the two scores, the Crawford flag, the match length, and a
 * trailing cube-availability flag this ignores.
 *
 * `+1` in the cube and turn fields means the upper-case side, `-1` the
 * lower-case one — matching how `@repo/galaxy-scraper` writes these strings.
 */
export function parseXgid(xgid: string): Xgid | null {
  const body = xgid.startsWith(PREFIX) ? xgid.slice(PREFIX.length) : xgid;
  const fields = body.split(":");
  if (fields.length < 9) return null;

  const position = parseBoard(fields[0] ?? "");
  if (!position) return null;

  const cubePosition = Number(fields[2]);
  const turn = Number(fields[3]);

  return {
    position,
    cube: {
      value: 2 ** Number(fields[1] ?? 0),
      owner: cubePosition === 0 ? null : cubePosition > 0 ? "player" : "opponent",
    },
    dice: parseDice(fields[4] ?? ""),
    scores: { player: Number(fields[5] ?? 0), opponent: Number(fields[6] ?? 0) },
    matchLength: Number(fields[8] ?? 0),
    crawford: fields[7] === "1",
    turn: turn < 0 ? "opponent" : "player",
  };
}
