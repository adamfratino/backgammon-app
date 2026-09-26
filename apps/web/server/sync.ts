import "server-only";
import type { DatabaseSync } from "node:sqlite";
import {
  DB_PATH,
  ensureCredentials,
  GalaxyClient,
  openDatabase,
  syncIncremental,
  withSyncLock,
} from "@repo/galaxy-scraper";

/** What started a run: the server booting, its interval, or the app opening. */
type SyncTrigger = "boot" | "interval" | "mount";

export interface SyncStatus {
  /** The `sync_runs` row of the latest run, or null before the first. */
  runId: number | null;
  state: "idle" | "checking" | "scraping" | "done" | "error";
  /** Categories fetched so far, out of `total`. */
  done: number;
  total: number;
  newBlunders: number;
  error: string | null;
  /** ISO 8601. Tells a page whether the run finished before it opened. */
  finishedAt: string | null;
}

/** Closer together than this, a second trigger is almost certainly the same moment. */
const MIN_GAP_MS = 2 * 60_000;

function startedRecently(db: DatabaseSync): boolean {
  const last = db.prepare("SELECT MAX(started_at) AS at FROM sync_runs").get() as {
    at: string | null;
  };
  return last.at !== null && Date.now() - Date.parse(last.at) < MIN_GAP_MS;
}

function createSyncJob() {
  let running = false;
  let status: SyncStatus = {
    runId: null,
    state: "idle",
    done: 0,
    total: 0,
    newBlunders: 0,
    error: null,
    finishedAt: null,
  };

  async function run(trigger: SyncTrigger): Promise<void> {
    // The app reads the database through a read-only handle, so the job opens its own.
    const db = openDatabase(DB_PATH);
    try {
      if (startedRecently(db)) return;

      const { lastInsertRowid } = db
        .prepare("INSERT INTO sync_runs (trigger, started_at) VALUES (?, ?)")
        .run(trigger, new Date().toISOString());
      const runId = Number(lastInsertRowid);
      status = { ...status, runId, state: "checking", done: 0, total: 0, error: null };

      const finish = (newBlunders: number, error: string | null): void => {
        const finishedAt = new Date().toISOString();
        db.prepare(
          "UPDATE sync_runs SET finished_at = ?, new_blunders = ?, error = ? WHERE id = ?",
        ).run(finishedAt, newBlunders, error, runId);
        status = { ...status, state: error ? "error" : "done", newBlunders, error, finishedAt };
      };

      try {
        const credentials = await ensureCredentials({ interactive: false, log: () => {} });
        const { newBlunders } = await syncIncremental(new GalaxyClient(credentials), db, {
          selfId: credentials.selfId,
          onPhase: (phase) => {
            if (phase.phase === "scraping") {
              status = { ...status, state: "scraping", done: phase.done, total: phase.total };
            }
          },
        });
        finish(newBlunders, null);
      } catch (error) {
        finish(0, error instanceof Error ? error.message : String(error));
      }
    } finally {
      db.close();
    }
  }

  return {
    /** Starts a run in the background, unless one is running or another started moments ago. */
    start(trigger: SyncTrigger): void {
      if (running) return;
      running = true;
      withSyncLock(() => run(trigger))
        .catch((error: unknown) => console.error("Galaxy sync failed:", error))
        .finally(() => {
          running = false;
        });
    },
    status: (): SyncStatus => status,
  };
}

// Next.js reloads modules on every edit in dev; cache on globalThis so there is
// one job, and one `running` flag, per server.
const globalForSync = globalThis as { sync?: ReturnType<typeof createSyncJob> };

export const sync = (globalForSync.sync ??= createSyncJob());
