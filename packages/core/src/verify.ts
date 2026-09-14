/**
 * Checks `parseXgid` against every position in the local database, and
 * `parseMove` against every play.
 *
 * The point is the cross-check: `@repo/galaxy-scraper` decodes a GNU BG
 * position id by an entirely separate route — base64 bit-unpacking rather than
 * character parsing — so the two agreeing on all 24 points, both bars and both
 * checker totals is real evidence, not a restatement of the same logic. Plays
 * are checked the same way, against the position Galaxy says each one leads to.
 *
 * Run with `pnpm --filter @repo/core verify`. Exits non-zero on any mismatch.
 */

import { DatabaseSync } from "node:sqlite";

import { DB_PATH } from "@repo/galaxy-scraper/config";
import { decodePositionId } from "@repo/galaxy-scraper/position";

import { BAR_PIP, POINT_COUNT } from "./constants.ts";
import { type CheckerMove, OFF_PIP, parseMove } from "./move.ts";
import { checkersOn } from "./side.ts";
import type { Position, Side } from "./types.ts";
import { parseXgid } from "./xgid.ts";

interface Row {
  blunder_id: number;
  kind: string;
  source_xgid: string;
  source_position_value: string;
  die_1: number | null;
  die_2: number | null;
  match_length: number | null;
  cube_value: number | null;
}

/** `board[1]` is the upper-case side of the XGID, which the parser calls `player`. */
function compareSide(id: number, label: string, decoded: number[], parsed: Side): string[] {
  const problems: string[] = [];

  for (let point = 1; point <= POINT_COUNT; point++) {
    const fromPositionId = decoded[point - 1] ?? 0;
    const fromXgid = checkersOn(parsed, point);
    if (fromPositionId !== fromXgid) {
      problems.push(
        `${id}: ${label} point ${point}: position id says ${fromPositionId}, XGID says ${fromXgid}`,
      );
    }
  }

  const bar = decoded[POINT_COUNT] ?? 0;
  if (bar !== parsed.bar) {
    problems.push(`${id}: ${label} bar: position id says ${bar}, XGID says ${parsed.bar}`);
  }

  const total = parsed.points.reduce((sum, n) => sum + n, 0) + parsed.bar + parsed.off;
  if (total !== 15) problems.push(`${id}: ${label} accounts for ${total} checkers, not 15`);

  return problems;
}

interface Play {
  blunder_id: number;
  rank: number;
  notation: string;
  source_xgid: string;
  result_xgid: string;
}

/**
 * Makes a play on the near side of a position, or says why it can't be made:
 * a checker leaving a stop it isn't on, a hit that finds no blot, or a landing
 * on a point the other side holds.
 */
function replay(before: Position, moves: CheckerMove[]): Position | string {
  const player = { ...before.player, points: [...before.player.points] };
  const opponent = { ...before.opponent, points: [...before.opponent.points] };

  for (const { from, to, hit } of moves) {
    if (from === BAR_PIP) {
      if (player.bar === 0) return `nothing on the bar`;
      player.bar -= 1;
    } else {
      if (checkersOn(player, from) === 0) return `nothing on ${from}`;
      player.points[from] = checkersOn(player, from) - 1;
    }

    if (to === OFF_PIP) {
      player.off += 1;
      continue;
    }

    const facing = POINT_COUNT + 1 - to;
    const blockers = checkersOn(opponent, facing);
    if (hit ? blockers !== 1 : blockers !== 0) {
      return `${hit ? "hit" : "landing"} on ${to} finds ${blockers} of the other side`;
    }
    if (hit) {
      opponent.points[facing] = 0;
      opponent.bar += 1;
    }
    player.points[to] = checkersOn(player, to) + 1;
  }

  return { player, opponent };
}

function sameSide(a: Side, b: Side): boolean {
  if (a.bar !== b.bar || a.off !== b.off) return false;
  for (let point = 1; point <= POINT_COUNT; point++) {
    if (checkersOn(a, point) !== checkersOn(b, point)) return false;
  }
  return true;
}

/**
 * Replays every candidate's notation from the near side of the position it was
 * played in, and compares the outcome with the XGID Galaxy gives for the
 * position after it. Agreement proves both `parseMove` and that the side on
 * roll is always drawn near — which the board's arrows rely on, and which the
 * XGID's own turn field does not reliably say.
 */
function checkPlays(db: DatabaseSync): { checked: number; problems: string[] } {
  const plays = db
    .prepare(
      `SELECT c.blunder_id, c.rank, c.notation, b.source_xgid, c.xgid AS result_xgid
       FROM candidate_moves c
       JOIN blunders b ON b.blunder_id = c.blunder_id
       WHERE c.notation IS NOT NULL AND c.xgid IS NOT NULL AND b.source_xgid IS NOT NULL`,
    )
    .all() as unknown as Play[];

  const problems: string[] = [];

  for (const play of plays) {
    const label = `${play.blunder_id} #${play.rank} ${play.notation}`;
    const moves = parseMove(play.notation);
    const before = parseXgid(play.source_xgid);
    const expected = parseXgid(play.result_xgid);
    if (!moves || !before || !expected) {
      problems.push(`${label}: could not be parsed`);
      continue;
    }

    const after = replay(before.position, moves);
    if (typeof after === "string") {
      problems.push(`${label}: ${after}`);
    } else if (
      !sameSide(after.player, expected.position.player) ||
      !sameSide(after.opponent, expected.position.opponent)
    ) {
      problems.push(`${label}: replayed position differs from ${play.result_xgid}`);
    }
  }

  return { checked: plays.length, problems };
}

function main(): void {
  const db = new DatabaseSync(process.env.BLUNDERS_DB_PATH ?? DB_PATH, { readOnly: true });

  const rows = db
    .prepare(
      `SELECT blunder_id, kind, source_xgid, source_position_value,
              die_1, die_2, match_length, cube_value
       FROM blunders
       WHERE source_xgid IS NOT NULL AND source_position_value IS NOT NULL`,
    )
    .all() as unknown as Row[];

  const problems: string[] = [];

  for (const row of rows) {
    const parsed = parseXgid(row.source_xgid);
    if (!parsed) {
      problems.push(`${row.blunder_id}: could not be parsed`);
      continue;
    }

    const board = decodePositionId(row.source_position_value);
    problems.push(...compareSide(row.blunder_id, "near", board[1], parsed.position.player));
    problems.push(...compareSide(row.blunder_id, "far", board[0], parsed.position.opponent));

    if (parsed.dice) {
      if (parsed.dice[0] !== row.die_1 || parsed.dice[1] !== row.die_2) {
        problems.push(
          `${row.blunder_id}: dice ${parsed.dice.join("-")} but columns say ${row.die_1}-${row.die_2}`,
        );
      }
    } else if (row.kind !== "cube") {
      // A cube decision is taken before the dice are thrown, so an XGID with
      // no dice is expected there and only there.
      problems.push(`${row.blunder_id}: no dice in the XGID, but this is a ${row.kind} blunder`);
    }

    if (row.match_length !== null && parsed.matchLength !== row.match_length) {
      problems.push(
        `${row.blunder_id}: match length ${parsed.matchLength}, column says ${row.match_length}`,
      );
    }

    if (row.cube_value !== null && parsed.cube.value !== row.cube_value) {
      problems.push(`${row.blunder_id}: cube ${parsed.cube.value}, column says ${row.cube_value}`);
    }
  }

  const plays = checkPlays(db);
  problems.push(...plays.problems);

  console.log(`checked ${rows.length} positions and ${plays.checked} plays`);

  if (problems.length === 0) {
    console.log(
      "every XGID agrees with its GNU BG position id, and every play replays onto its result",
    );
    return;
  }

  console.error(`${problems.length} problems:`);
  for (const problem of problems.slice(0, 20)) console.error(`  ${problem}`);
  if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
  process.exitCode = 1;
}

main();
