import type { DatabaseSync } from "node:sqlite";
import { writeMatch } from "./db.ts";
import { type History, type MatchClient, pullMatch, readHistory } from "./matches.ts";
import { normalize } from "./transform.ts";

type SyncPhase =
  { phase: "checking"; runId: number } | { phase: "fetching"; done: number; total: number };

interface SyncOptions {
  /** What started the run, as `sync_runs` records it: `boot`, `interval`, `mount`, `cli`. */
  trigger: string;
  /** Walk the whole match history, not just the newest 50. */
  full?: boolean;
  /**
   * Logs in and hands back a client. Called inside the run, so a login that has
   * run out is recorded as the run's error like any other failure.
   */
  connect: () => Promise<{
    client: MatchClient;
    /** The account holder's Galaxy id, which decides who is "self" in each match. */
    selfId: string | null;
  }>;
  onPhase?: (phase: SyncPhase) => void;
  onProgress?: (message: string) => void;
}

const startRun = (db: DatabaseSync, trigger: string): number =>
  Number(
    db
      .prepare("INSERT INTO sync_runs (trigger, started_at) VALUES (?, ?)")
      .run(trigger, new Date().toISOString()).lastInsertRowid,
  );

function finishRun(
  db: DatabaseSync,
  runId: number,
  run: { newBlunders: number; error: string | null; backfilled: boolean },
): void {
  db.prepare(
    "UPDATE sync_runs SET finished_at = ?, new_blunders = ?, error = ?, backfilled = ? WHERE id = ?",
  ).run(new Date().toISOString(), run.newBlunders, run.error, run.backfilled ? 1 : 0, runId);
}

/** Whether a clean run has walked the whole history, which the first one has to. */
const hasBackfilled = (db: DatabaseSync): boolean =>
  db
    .prepare(
      "SELECT 1 FROM sync_runs WHERE backfilled = 1 AND finished_at IS NOT NULL AND error IS NULL",
    )
    .get() !== undefined;

/**
 * Pulls the matches Galaxy has finished since the last sync, with every
 * blunder in them, and records the run in `sync_runs`. One request for the 50
 * newest match ids says whether there is anything new at all.
 *
 * The first run, a `full` one, and one that finds all 50 new walk the whole
 * history instead, and pull every match in it again, along with any the
 * database has that the history leaves out.
 */
export async function syncIncremental(
  db: DatabaseSync,
  { trigger, full = false, connect, onPhase = () => {}, onProgress = () => {} }: SyncOptions,
): Promise<{ runId: number; newMatches: number; newBlunders: number }> {
  const runId = startRun(db, trigger);
  onPhase({ phase: "checking", runId });

  try {
    const { client, selfId } = await connect();
    if (!selfId) throw new Error("The saved login has no Galaxy user id. Run login again.");
    const names = new Map(
      (
        db.prepare("SELECT match_id, opponent_name FROM matches").all() as {
          match_id: number;
          opponent_name: string | null;
        }[]
      ).map(({ match_id, opponent_name }) => [match_id, opponent_name]),
    );

    const newest = (await client.fetchResults(selfId)).results.map(({ match_id }) => match_id);
    const unknown = newest.filter((id) => !names.has(id));
    // Every one of them new means the gap may run further back than `results` reaches.
    const backfilled =
      full || !hasBackfilled(db) || (unknown.length > 0 && unknown.length === newest.length);

    let ids = unknown;
    let history: History = { selfName: null, opponents: new Map() };
    if (backfilled) {
      onProgress("Walking the whole match history...");
      history = await readHistory(client);
      ids = [...new Set([...newest, ...history.opponents.keys(), ...names.keys()])];
    } else if (ids.length > 0) {
      history = await readHistory(client, 1);
    }

    let newMatches = 0;
    let newBlunders = 0;
    for (const [done, matchId] of ids.entries()) {
      onPhase({ phase: "fetching", done, total: ids.length });
      const knownName = names.get(matchId) ?? null;
      const record = await pullMatch(client, matchId, { history, selfId, knownName });
      if (!record) {
        onProgress(`  ${matchId}: not analysed yet`);
        continue;
      }
      const batch = normalize(record, selfId);
      writeMatch(db, batch);
      if (!names.has(matchId)) {
        newMatches++;
        newBlunders += batch.blunders.length;
      }
      onProgress(`  ${matchId}: ${batch.blunders.length} blunders (${done + 1} of ${ids.length})`);
    }

    finishRun(db, runId, { newBlunders, error: null, backfilled });
    return { runId, newMatches, newBlunders };
  } catch (error) {
    try {
      const message = error instanceof Error ? error.message : String(error);
      finishRun(db, runId, { newBlunders: 0, error: message, backfilled: false });
    } catch {
      // The database may be what failed; the caller still hears about the first error.
    }
    throw error;
  }
}
