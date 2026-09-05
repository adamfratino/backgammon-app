import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
  opponent_score     INTEGER
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

-- A blunder can surface under more than one API category (e.g. "recent").
CREATE TABLE IF NOT EXISTS blunder_categories (
  blunder_id INTEGER REFERENCES blunders(blunder_id),
  category   TEXT,
  PRIMARY KEY (blunder_id, category)
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
  return `INSERT OR REPLACE INTO ${table} (${names}) VALUES (${placeholders})`;
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

export function openDatabase(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

export interface WriteCounts {
  matches: number;
  blunders: number;
  candidates: number;
  cubes: number;
}

export function writeBatch(db: DatabaseSync, batch: NormalizedBatch): WriteCounts {
  const counts: WriteCounts = { matches: 0, blunders: 0, candidates: 0, cubes: 0 };

  const run = <T extends object>(table: string, rows: T[]): number => {
    const first = rows[0];
    if (!first) return 0;
    const statement = db.prepare(insertSql(table, Object.keys(first)));
    for (const row of rows) statement.run(bindable(row));
    return rows.length;
  };

  db.exec("BEGIN");
  try {
    // Matches first so the blunder foreign key resolves.
    counts.matches = run("matches", batch.matches);
    counts.blunders = run("blunders", batch.blunders);
    counts.candidates = run("candidate_moves", batch.candidates);
    counts.cubes = run("cube_decisions", batch.cubes);
    run("blunder_categories", batch.links);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return counts;
}
