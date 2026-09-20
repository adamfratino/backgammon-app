/**
 * GNU Backgammon position/match ID decoding, and re-encoding as XGID.
 *
 * Galaxy hands us a GNU BG `positionId:matchId` pair for the position a
 * blunder was made in, but only ever gives an XGID for the positions that
 * *result* from each candidate move. Decoding lets us produce an XGID for the
 * position actually faced, which is the one worth studying.
 *
 * Verified against every `gnubgid`/`xgid` pair Galaxy returns — see `verify.ts`.
 */

/** `anBoard[player][point]`: 0-23 are that player's points 1-24, 24 is their bar. */
export type Board = [number[], number[]];

export interface MatchState {
  cubeExponent: number;
  /** 0 or 1 for an owner, 3 when centred. */
  cubeOwner: number;
  /**
   * The side the board is written from — gnubg's `fMove`. `decodePositionId`
   * puts this player's checkers in `board[1]`, which the XGID draws in upper
   * case, so it is the one fact tying the match id's player numbers to the
   * board string beside them.
   */
  onMove: number;
  crawford: boolean;
  gameState: number;
  turn: number;
  doubled: boolean;
  resigned: number;
  dice: [number, number];
  matchLength: number;
  scores: [number, number];
}

function decodeBase64(value: string): Buffer {
  return Buffer.from(value + "=".repeat((4 - (value.length % 4)) % 4), "base64");
}

const bitAt = (buf: Buffer, index: number): number => ((buf[index >> 3] ?? 0) >> (index & 7)) & 1;

/**
 * Each player is written as, for each of 25 points, one 1-bit per checker
 * followed by a terminating 0-bit — least significant bit first.
 */
export function decodePositionId(positionId: string): Board {
  const bytes = decodeBase64(positionId);
  const board: Board = [[], []];
  let index = 0;

  for (const side of board) {
    for (let point = 0; point < 25; point++) {
      let checkers = 0;
      while (index < bytes.length * 8 && bitAt(bytes, index++) === 1) checkers++;
      side.push(checkers);
    }
  }

  return board;
}

/** Fixed-width little-endian bit fields, in the order gnubg writes them. */
export function decodeMatchId(matchId: string): MatchState {
  const bytes = decodeBase64(matchId);
  let index = 0;

  const read = (width: number): number => {
    let value = 0;
    for (let i = 0; i < width; i++) value |= bitAt(bytes, index++) << i;
    return value;
  };

  const cubeExponent = read(4);
  const cubeOwner = read(2);
  const onMove = read(1);
  const crawford = read(1) === 1;
  const gameState = read(3);
  const turn = read(1);
  const doubled = read(1) === 1;
  const resigned = read(2);
  const die0 = read(3);
  const die1 = read(3);
  const matchLength = read(15);
  const score0 = read(15);
  const score1 = read(15);

  return {
    cubeExponent,
    cubeOwner,
    onMove,
    crawford,
    gameState,
    turn,
    doubled,
    resigned,
    dice: [die0, die1],
    matchLength,
    scores: [score0, score1],
  };
}

/** 1-15 checkers as a-o (lower player) or A-O (upper player). */
function checkerChar(count: number, upper: boolean): string {
  if (count <= 0) return "-";
  const base = upper ? 65 : 97;
  return String.fromCharCode(base + Math.min(count, 15) - 1);
}

/**
 * XGID board is 26 characters: index 0 is the lower player's bar, 1-24 are
 * points numbered from the upper player's side, and 25 is the upper player's
 * bar. Lower-case is `board[0]`, upper-case `board[1]`.
 */
export function boardToXgidString(board: Board): string {
  let out = checkerChar(board[0][24] ?? 0, false);

  for (let point = 1; point <= 24; point++) {
    const upper = board[1][point - 1] ?? 0;
    const lower = board[0][24 - point] ?? 0;
    if (upper > 0) out += checkerChar(upper, true);
    else if (lower > 0) out += checkerChar(lower, false);
    else out += "-";
  }

  return out + checkerChar(board[1][24] ?? 0, true);
}

export interface XgidOptions {
  /** Overrides the trailing cube-availability flag, which is otherwise derived. */
  maxCube?: number;
}

/**
 * Which side of the board holds the cube, as XG writes it: 0 centred, +1 the
 * upper-case side, -1 the lower-case one.
 *
 * gnubg encodes a centred cube as owner 3 and an owned one as an absolute
 * player number, which says nothing on its own about which way round the board
 * beside it was written — so the owner only becomes a side once it is read
 * through `onMove`.
 */
export function cubePositionOf(match: MatchState): number {
  if (match.cubeOwner === 3) return 0;
  return match.cubeOwner === match.onMove ? 1 : -1;
}

export function toXgid(board: Board, match: MatchState, options: XgidOptions = {}): string {
  // Every field below the board is keyed to gnubg's own player numbers, which
  // say nothing about which way round the board string was written. Reading
  // each one through `onMove` — the side `decodePositionId` put in upper case —
  // is what makes them describe the board they are sitting next to.
  const near = match.onMove;

  // The board is always written from the side about to play — the mover on a
  // checker play, and the player being doubled on a take/pass — so in XG's
  // terms, where the field is relative to the board string, the upper-case side
  // is on roll every time. gnubg's own turn bit is not that fact: it is an
  // absolute player number, and on a pending double it names the doubler
  // rather than the side left to answer.
  const turn = 1;

  // XG asks for the upper-case side's score first.
  const [nearScore, farScore] = [match.scores[near], match.scores[1 - near]];

  // The trailing field is cube availability: dead during the Crawford game.
  const cubeAvailable = options.maxCube ?? (match.crawford ? 0 : 1);

  return [
    `XGID=${boardToXgidString(board)}`,
    match.cubeExponent,
    cubePositionOf(match),
    turn,
    `${match.dice[0]}${match.dice[1]}`,
    nearScore,
    farScore,
    match.crawford ? 1 : 0,
    match.matchLength,
    cubeAvailable,
  ].join(":");
}

/** Convenience for Galaxy's combined `positionId:matchId` string. */
export function gnubgIdToXgid(gnubgId: string, options: XgidOptions = {}): string | null {
  const [positionId, matchId] = gnubgId.split(":");
  if (!positionId || !matchId) return null;
  return toXgid(decodePositionId(positionId), decodeMatchId(matchId), options);
}
