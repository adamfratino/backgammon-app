import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { cubePositionOf, decodeMatchId, decodePositionId, toXgid } from "./position.ts";
import type { NormalizedBatch } from "./transform.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS matches (
  match_id           INTEGER PRIMARY KEY,
  finished_at        TEXT,
  length             INTEGER,
  status             TEXT,
  subtype            TEXT,
  analysis_level     INTEGER,
  tournament_id      TEXT,
  self_id            TEXT,
  self_name          TEXT,
  self_score         INTEGER,
  opponent_id        TEXT,
  opponent_name      TEXT,
  opponent_score     INTEGER,
  self_error_rate    REAL,
  opponent_error_rate REAL
);

CREATE TABLE IF NOT EXISTS blunders (
  blunder_id                 INTEGER PRIMARY KEY,
  match_id                   INTEGER REFERENCES matches(match_id),
  kind                       TEXT,
  flagged_event_type         TEXT,
  cube_action                TEXT,
  color                      TEXT,
  die_1                      INTEGER,
  die_2                      INTEGER,
  source_classification      TEXT,
  destination_classification TEXT,
  raw_error                  REAL,
  error_magnitude            REAL,
  mwc_error                  REAL,
  error_severity             TEXT,
  is_blunder                 INTEGER,
  cube_raw_error             REAL,
  cube_error_severity        TEXT,
  cube_is_blunder            INTEGER,
  luck                       REAL,
  equity                     REAL,
  match_length               INTEGER,
  score_black                INTEGER,
  score_white                INTEGER,
  crawford_state             TEXT,
  analysis_level             INTEGER,
  source_position_id         INTEGER,
  source_position_value      TEXT,
  source_match_value         TEXT,
  gnubg_id                   TEXT,
  source_xgid                TEXT,
  cube_value                 INTEGER,
  cube_position              INTEGER,
  played_notation            TEXT,
  best_notation              TEXT,
  played_rank                INTEGER,
  candidate_count            INTEGER,
  win                        REAL,
  win_gammon                 REAL,
  win_backgammon             REAL,
  lose                       REAL,
  lose_gammon                REAL,
  lose_backgammon            REAL,
  mwc                        REAL
);

CREATE TABLE IF NOT EXISTS candidate_moves (
  blunder_id   INTEGER REFERENCES blunders(blunder_id),
  rank         INTEGER,
  notation     TEXT,
  equity       REAL,
  equity_error REAL,
  move_played  INTEGER,
  level        INTEGER,
  xgid         TEXT,
  gnubgid      TEXT,
  win          REAL,
  win_gammon   REAL,
  win_backgammon REAL,
  lose         REAL,
  lose_gammon  REAL,
  lose_backgammon REAL,
  mwc          REAL,
  PRIMARY KEY (blunder_id, rank)
);

CREATE TABLE IF NOT EXISTS cube_decisions (
  blunder_id                INTEGER PRIMARY KEY REFERENCES blunders(blunder_id),
  cube_level                INTEGER,
  cubeless                  REAL,
  no_double                 REAL,
  double_take               REAL,
  double_pass               REAL,
  optimal                   REAL,
  diff_no_double            REAL,
  diff_double_take          REAL,
  diff_double_pass          REAL,
  receiver_diff_double_take REAL,
  receiver_diff_double_pass REAL,
  doublers_best_action      TEXT,
  receivers_best_action     TEXT
);

-- The category each blunder is listed under: its position's classification, in the app's names.
CREATE TABLE IF NOT EXISTS blunder_categories (
  blunder_id INTEGER REFERENCES blunders(blunder_id),
  category   TEXT,
  PRIMARY KEY (blunder_id, category)
);

-- One row per sync the web server ran, for spacing them out and saying when the last one was.
CREATE TABLE IF NOT EXISTS sync_runs (
  id           INTEGER PRIMARY KEY,
  trigger      TEXT NOT NULL,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  new_blunders INTEGER,
  error        TEXT,
  -- 1 when the run walked the whole match history rather than the newest 50.
  backfilled   INTEGER
);

CREATE INDEX IF NOT EXISTS idx_blunders_class    ON blunders(source_classification);
CREATE INDEX IF NOT EXISTS idx_blunders_error    ON blunders(error_magnitude DESC);
CREATE INDEX IF NOT EXISTS idx_blunders_match    ON blunders(match_id);
CREATE INDEX IF NOT EXISTS idx_blunders_kind     ON blunders(kind);
CREATE INDEX IF NOT EXISTS idx_blunders_action   ON blunders(cube_action);
CREATE INDEX IF NOT EXISTS idx_blunders_xgid     ON blunders(source_xgid);
CREATE INDEX IF NOT EXISTS idx_candidates_played ON candidate_moves(move_played);
CREATE INDEX IF NOT EXISTS idx_matches_finished  ON matches(finished_at);
`;

function insertSql(table: string, columns: string[]): string {
  const names = columns.join(", ");
  const placeholders = columns.map((c) => `$${c}`).join(", ");
  return `INSERT INTO ${table} (${names}) VALUES (${placeholders})`;
}

/**
 * Galaxy's match endpoint names neither player, so a sync that couldn't find a
 * name keeps the one the row has. Nor does a deleted account's placeholder
 * replace the name it had.
 */
function upsertMatchSql(columns: string[]): string {
  const update = (c: string): string => {
    if (c === "self_name") return "self_name = COALESCE(excluded.self_name, self_name)";
    if (c === "opponent_name") {
      return `opponent_name = CASE WHEN excluded.opponent_name IS NULL OR excluded.opponent_name = 'Deleted User'
        THEN COALESCE(opponent_name, excluded.opponent_name) ELSE excluded.opponent_name END`;
    }
    return `${c} = excluded.${c}`;
  };
  return `${insertSql("matches", columns)}
    ON CONFLICT (match_id) DO UPDATE SET ${columns
      .filter((c) => c !== "match_id")
      .map(update)
      .join(", ")}`;
}

/** node:sqlite rejects booleans and undefined; coerce to storable primitives. */
function bindable(row: object): Record<string, null | number | string> {
  const out: Record<string, null | number | string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === null) out[key] = null;
    else if (typeof value === "boolean") out[key] = value ? 1 : 0;
    else if (typeof value === "number" || typeof value === "string") out[key] = value;
    else out[key] = JSON.stringify(value);
  }
  return out;
}

/**
 * `SCHEMA` only creates tables that are missing, so a table built before one of
 * these columns existed never gets it from there. This adds them, empty; the
 * next sync fills in the error rates.
 */
const LATE_COLUMNS = [
  ["matches", "self_error_rate", "REAL"],
  ["matches", "opponent_error_rate", "REAL"],
  ["sync_runs", "backfilled", "INTEGER"],
] as const;

function addLateColumns(db: DatabaseSync): void {
  for (const [table, column, type] of LATE_COLUMNS) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!columns.some(({ name }) => name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
}

export function openDatabase(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  // Every checkout's dev server and the CLI can write this file. Wait out another
  // writer's transaction rather than failing the moment it holds the lock.
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  addLateColumns(db);
  return db;
}

/**
 * Writes a match and replaces its blunders with the batch's, in one
 * transaction, so a match never shows half of one sync and half of another.
 */
export function writeMatch(db: DatabaseSync, batch: NormalizedBatch): void {
  const run = <T extends object>(table: string, rows: T[]): void => {
    const first = rows[0];
    if (!first) return;
    const statement = db.prepare(insertSql(table, Object.keys(first)));
    for (const row of rows) statement.run(bindable(row));
  };

  db.exec("BEGIN");
  try {
    db.prepare(upsertMatchSql(Object.keys(batch.match))).run(bindable(batch.match));
    const { match_id } = batch.match;
    for (const table of ["candidate_moves", "cube_decisions", "blunder_categories"]) {
      db.prepare(
        `DELETE FROM ${table} WHERE blunder_id IN (SELECT blunder_id FROM blunders WHERE match_id = ?)`,
      ).run(match_id);
    }
    db.prepare("DELETE FROM blunders WHERE match_id = ?").run(match_id);
    run("blunders", batch.blunders);
    run("candidate_moves", batch.candidates);
    run("cube_decisions", batch.cubes);
    run("blunder_categories", batch.links);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export interface ReencodeCounts {
  checked: number;
  rewritten: number;
}

/**
 * Rebuilds the columns derived from a blunder's GNU BG ids — the XGID and the
 * two cube columns — from `source_position_value` and `source_match_value`,
 * which every row keeps.
 *
 * `load` can only reach matches still cached in `raw/`, so a change to how
 * positions are encoded would otherwise land on some rows and not others,
 * which is worse than landing on none. This reaches all of them and needs no
 * network.
 */
export function reencodeXgids(db: DatabaseSync): ReencodeCounts {
  const rows = db
    .prepare(
      `SELECT blunder_id, source_position_value, source_match_value
         FROM blunders
        WHERE source_position_value IS NOT NULL AND source_match_value IS NOT NULL`,
    )
    .all() as unknown as {
    blunder_id: number;
    source_position_value: string;
    source_match_value: string;
  }[];

  const update = db.prepare(
    `UPDATE blunders SET source_xgid = ?, cube_value = ?, cube_position = ?
      WHERE blunder_id = ?`,
  );

  let rewritten = 0;
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      const match = decodeMatchId(row.source_match_value);
      const xgid = toXgid(decodePositionId(row.source_position_value), match);
      const changed = update.run(
        xgid,
        2 ** match.cubeExponent,
        cubePositionOf(match),
        row.blunder_id,
      );
      rewritten += Number(changed.changes);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return { checked: rows.length, rewritten };
}
