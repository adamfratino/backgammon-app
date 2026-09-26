import type { DatabaseSync } from "node:sqlite";
import type { GalaxyClient } from "./api.ts";
import { writeBatch } from "./db.ts";
import { resolveCategories, scrapeCategory } from "./scrape.ts";
import { normalize } from "./transform.ts";

type SyncPhase =
  | { phase: "checking"; runId: number }
  | { phase: "scraping"; category: string; done: number; total: number };

interface SyncOptions {
  /** What started the run, as `sync_runs` records it: `boot`, `interval`, `mount`, `cli`. */
  trigger: string;
  /**
   * Logs in and hands back a client. Called inside the run, so a login that has
   * run out is recorded as the run's error like any other failure.
   */
  connect: () => Promise<{
    client: Pick<GalaxyClient, "fetchCategories" | "fetchCategoryPage">;
    /** The account holder's Galaxy id, which decides who is "self" in each match. */
    selfId: string | null;
  }>;
  onPhase?: (phase: SyncPhase) => void;
  onProgress?: (message: string) => void;
}

const maxBlunderId = (db: DatabaseSync): number =>
  (db.prepare("SELECT COALESCE(MAX(blunder_id), 0) AS id FROM blunders").get() as { id: number })
    .id;

/**
 * Everything at or below this id is in the database: the top of `recent` when
 * the last clean run checked it. A failed run leaves it where it was, so the
 * next one re-walks whatever the failed one missed. The table's own highest id
 * can't do this: a run that fails halfway has already raised it.
 */
function highWater(db: DatabaseSync): number {
  const { mark } = db
    .prepare(
      "SELECT MAX(high_water) AS mark FROM sync_runs WHERE finished_at IS NOT NULL AND error IS NULL",
    )
    .get() as { mark: number | null };
  if (mark !== null) return mark;
  // Before any clean run, the table is all there is to go on. Record it as one,
  // so that a first run failing halfway can't move it either.
  return markSynced(db, "baseline");
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
  run: { newBlunders: number; error: string | null; highWater: number | null },
): void {
  db.prepare(
    "UPDATE sync_runs SET finished_at = ?, new_blunders = ?, error = ?, high_water = ? WHERE id = ?",
  ).run(new Date().toISOString(), run.newBlunders, run.error, run.highWater, runId);
}

/** Records everything in the table as synced, and returns the id that now marks it. */
function markSynced(db: DatabaseSync, trigger: string): number {
  const highWater = maxBlunderId(db);
  finishRun(db, startRun(db, trigger), { newBlunders: 0, error: null, highWater });
  return highWater;
}

/**
 * Records a `--full` walk as a clean run, so the next incremental sync starts
 * from everything it loaded rather than reporting it as new.
 */
export function recordFullSync(db: DatabaseSync): void {
  markSynced(db, "full");
}

/**
 * Fetches only what Galaxy has added since the last clean sync, and records the
 * run in `sync_runs`. Every category lists its blunders newest first, and ids
 * only grow, so one page of `recent` says whether there is anything new at all,
 * and each category can stop at the first page holding an id already synced.
 */
export async function syncIncremental(
  db: DatabaseSync,
  { trigger, connect, onPhase = () => {}, onProgress }: SyncOptions,
): Promise<{ runId: number; newBlunders: number }> {
  const known = highWater(db);
  const isNew = (event: { blunder_id: number }): boolean => event.blunder_id > known;
  const runId = startRun(db, trigger);
  onPhase({ phase: "checking", runId });

  try {
    const { client, selfId } = await connect();
    const recent = (await client.fetchCategoryPage("recent", 1))?.data?.events ?? [];
    const mark = recent.reduce((top, { blunder_id }) => Math.max(top, blunder_id), known);

    if (recent.some(isNew)) {
      const categories = resolveCategories((await client.fetchCategories())?.counts ?? null, {});
      for (const [done, category] of categories.entries()) {
        onPhase({ phase: "scraping", category, done, total: categories.length });
        await scrapeCategory(client, category, {
          onProgress,
          // Rewriting a row already synced would blank any column this checkout doesn't know.
          onPage: (events) => writeBatch(db, normalize(events.filter(isNew), category, selfId)),
          stopAfter: (events) => !events.every(isNew),
        });
      }
    }

    const { n: newBlunders } = db
      .prepare("SELECT COUNT(*) AS n FROM blunders WHERE blunder_id > ?")
      .get(known) as { n: number };
    finishRun(db, runId, { newBlunders, error: null, highWater: mark });
    return { runId, newBlunders };
  } catch (error) {
    try {
      const message = error instanceof Error ? error.message : String(error);
      finishRun(db, runId, { newBlunders: 0, error: message, highWater: null });
    } catch {
      // The database may be what failed; the caller still hears about the first error.
    }
    throw error;
  }
}
