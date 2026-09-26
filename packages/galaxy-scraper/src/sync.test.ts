import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { MatchEvent } from "./types.ts";

// Matches are cached beside the database, so keep them out of the real one's folder.
process.env.BLUNDERS_DB_PATH = join(mkdtempSync(join(tmpdir(), "galaxy-scraper-sync-")), "x.db");
const { openDatabase } = await import("./db.ts");
const { syncIncremental } = await import("./sync.ts");

const SELF = "self";
const OPPONENT = "opponent";

let nextId = 1;
/** One of `user`'s decisions, reviewed unless it's a forfeit, and flagged as a blunder if `blunder`. */
const decision = (event_type: string, user_id: string, blunder = false): MatchEvent =>
  ({
    id: nextId++,
    event_type,
    user_id,
    color: "black",
    rolled_dice: event_type === "dice_rolled" ? [3, 1] : [],
    reviews:
      event_type === "turn_forfeited"
        ? []
        : [
            {
              id: nextId++,
              source_position: { id: 1, classification: "6_prime", formatted_value: "x" },
              result: { result: { error_analysis: { is_blunder: blunder, raw_error: -0.1 } } },
            },
          ],
  }) as unknown as MatchEvent;

interface FakeMatch {
  id: number;
  games: MatchEvent[][];
  /** The name the history list gives; left out, the list doesn't have the match. */
  listed?: string;
  analysed?: boolean;
}

function fakeGalaxy(matches: FakeMatch[]) {
  const requests: string[] = [];
  const byId = new Map(matches.map((match) => [match.id, match]));
  const listed = matches.filter((match) => match.listed !== undefined);
  const get = (id: number): FakeMatch => byId.get(id) ?? assert.fail(`no match ${id}`);
  return {
    requests,
    client: {
      async fetchResults() {
        requests.push("results");
        return { results: matches.slice(0, 50).map(({ id }) => ({ match_id: id })) } as never;
      },
      async fetchHistoryPage(page: number) {
        requests.push(`list/${page}`);
        const analyses = listed
          .slice((page - 1) * 30, page * 30)
          .map(({ id, listed }) => ({ matchId: id, opponentName: listed ?? null }));
        return { page, totalPages: Math.ceil(listed.length / 30), userName: "me", analyses };
      },
      async fetchMatch(id: number) {
        requests.push(`match/${id}`);
        const player = (id: string) => ({ id, type: "user", attributes: {} });
        const attributes = { player1: player(SELF), player2: player(OPPONENT), length: 3 };
        const meta = { analytics: get(id).analysed === false ? "pending" : "ok" };
        return { data: { id, type: "match", attributes }, meta } as never;
      },
      async fetchGameReview(id: number, game: number) {
        requests.push(`review/${id}/${game}`);
        return { data: { match_id: id, game_index: game, events: get(id).games[game - 1] ?? [] } };
      },
      async fetchMatFile(id: number) {
        requests.push(`mat/${id}`);
        return `; [Player 1 "me"]\n; [Player 2 "from-mat"]\n`;
      },
    },
  };
}

type Database = ReturnType<typeof openDatabase>;

async function run(db: Database, matches: FakeMatch[], full = false) {
  const fake = fakeGalaxy(matches);
  const result = await syncIncremental(db, {
    trigger: "test",
    full,
    connect: async () => ({ client: fake.client, selfId: SELF }),
  });
  return { ...result, requests: fake.requests };
}

let nextMatch = 1000;
/** A listed match with one game, holding one blunder of mine unless `clean`. */
const match = (clean = false, extra: Partial<FakeMatch> = {}): FakeMatch => ({
  id: nextMatch++,
  listed: "rival",
  games: [[decision("dice_rolled", SELF), decision("move_commited", SELF, !clean)]],
  ...extra,
});

const rows = (db: Database, sql: string, ...params: number[]) =>
  db
    .prepare(sql)
    .all(...params)
    .map((row) => ({ ...row }));

test("the first run walks the whole history, clean matches included", async () => {
  const db = openDatabase(":memory:");
  const [clean, flagged] = [match(true), match()];
  const synced = await run(db, [clean, flagged]);
  assert.deepEqual(synced.requests, [
    "results",
    "list/1",
    `match/${clean.id}`,
    `review/${clean.id}/1`,
    `review/${clean.id}/2`,
    `match/${flagged.id}`,
    `review/${flagged.id}/1`,
    `review/${flagged.id}/2`,
  ]);
  assert.deepEqual(
    rows(
      db,
      "SELECT match_id, COUNT(blunder_id) AS n FROM matches LEFT JOIN blunders USING (match_id) GROUP BY 1",
    ),
    [
      { match_id: clean.id, n: 0 },
      { match_id: flagged.id, n: 1 },
    ],
  );
  assert.equal(synced.newMatches, 2);
  assert.equal(synced.newBlunders, 1);
});

test("nothing new: one request", async () => {
  const db = openDatabase(":memory:");
  const matches = [match(), match()];
  await run(db, matches);
  const again = await run(db, matches);
  assert.deepEqual(again.requests, ["results"]);
  assert.equal(again.newMatches, 0);
});

test("a new match: its games, and page 1 of the history for its opponent's name", async () => {
  const db = openDatabase(":memory:");
  const old = [match()];
  await run(db, old);
  const fresh = match(false, { listed: "newcomer" });
  const synced = await run(db, [fresh, ...old]);
  assert.deepEqual(synced.requests, [
    "results",
    "list/1",
    `match/${fresh.id}`,
    `review/${fresh.id}/1`,
    `review/${fresh.id}/2`,
  ]);
  assert.deepEqual(
    rows(db, "SELECT opponent_name, self_name FROM matches WHERE match_id = ?", fresh.id),
    [{ opponent_name: "newcomer", self_name: "me" }],
  );
});

test("all 50 newest unknown: walks the whole history", async () => {
  const db = openDatabase(":memory:");
  const old = [match()];
  await run(db, old);
  const synced = await run(db, [...Array.from({ length: 50 }, () => match(true)), ...old]);
  assert.ok(synced.requests.includes("list/2"));
  assert.equal(rows(db, "SELECT * FROM matches").length, 51);
});

test("a match Galaxy hasn't analysed yet is asked for again next run", async () => {
  const db = openDatabase(":memory:");
  const old = [match()];
  await run(db, old);
  const pending = match(false, { analysed: false });
  await run(db, [pending, ...old]);
  assert.equal(rows(db, "SELECT * FROM matches WHERE match_id = ?", pending.id).length, 0);
  const synced = await run(db, [{ ...pending, analysed: true }, ...old]);
  assert.equal(synced.newBlunders, 1);
});

test("a match the history leaves out takes its names from the .mat", async () => {
  const db = openDatabase(":memory:");
  const old = [match()];
  await run(db, old);
  const unlisted = match(false, { listed: undefined });
  const synced = await run(db, [unlisted, ...old]);
  assert.ok(synced.requests.includes(`mat/${unlisted.id}`));
  assert.deepEqual(rows(db, "SELECT opponent_name FROM matches WHERE match_id = ?", unlisted.id), [
    { opponent_name: "from-mat" },
  ]);
});

test("a deleted account doesn't replace the name the match had", async () => {
  const db = openDatabase(":memory:");
  const known = match();
  await run(db, [known]);
  const synced = await run(db, [{ ...known, listed: "Deleted User" }], true);
  assert.ok(!synced.requests.includes(`mat/${known.id}`));
  assert.deepEqual(rows(db, "SELECT opponent_name FROM matches"), [{ opponent_name: "rival" }]);
});

test("a full walk rebuilds a match's blunders, and reuses what it cached", async () => {
  const db = openDatabase(":memory:");
  const known = match();
  await run(db, [known]);
  db.exec("UPDATE blunders SET raw_error = -9");
  const synced = await run(db, [known], true);
  assert.deepEqual(synced.requests, ["results", "list/1"]);
  assert.deepEqual(rows(db, "SELECT raw_error FROM blunders"), [{ raw_error: -0.1 }]);
  assert.equal(synced.newBlunders, 0);
});

test("blunders: mine only, a roll paired with its play, doubles alone", async () => {
  const db = openDatabase(":memory:");
  const game = [
    decision("dice_rolled", OPPONENT),
    decision("move_commited", OPPONENT, true),
    decision("dice_rolled", SELF, true),
    decision("move_commited", SELF, true),
    decision("double_requested", SELF, true),
    decision("double_accepted", OPPONENT),
    decision("dice_rolled", SELF, true),
    decision("turn_forfeited", SELF),
    decision("dice_rolled", SELF),
    decision("move_commited", SELF),
  ];
  await run(db, [match(false, { games: [game] })]);
  assert.deepEqual(
    rows(db, "SELECT kind, flagged_event_type, cube_action FROM blunders ORDER BY blunder_id"),
    [
      { kind: "both", flagged_event_type: "move_commited", cube_action: "dice_rolled" },
      { kind: "cube", flagged_event_type: "double_requested", cube_action: "double_requested" },
      { kind: "cube", flagged_event_type: "dice_rolled", cube_action: "dice_rolled" },
    ],
  );
  assert.deepEqual(rows(db, "SELECT DISTINCT category FROM blunder_categories"), [
    { category: "six_prime" },
  ]);
});
