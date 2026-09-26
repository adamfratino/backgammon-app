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
  state: "idle" | "checking" | "fetching" | "done" | "error";
  /** Matches fetched so far, out of `total`. */
  done: number;
  total: number;
  newBlunders: number;
  error: string | null;
}

/**
 * How often the server syncs while it runs. `GALAXY_SYNC_INTERVAL_MS=0` turns
 * syncing off altogether, including when the app opens. Capped at the longest
 * wait `setInterval` takes; past it, Node fires every millisecond instead.
 */
export const SYNC_INTERVAL_MS = Math.min(
  Number(process.env.GALAXY_SYNC_INTERVAL_MS ?? 10 * 60_000),
  2 ** 31 - 1,
);

/**
 * An app opening this soon after another run has nothing to add. Boot and the
 * interval aren't held to it: restarting the server is asking for a sync.
 */
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
  };

  async function run(trigger: SyncTrigger): Promise<void> {
    // The app reads the database through a read-only handle, so the job opens its own.
    const db = openDatabase(DB_PATH);
    try {
      if (trigger === "mount" && startedRecently(db)) return;

      const { newBlunders } = await syncIncremental(db, {
        trigger,
        connect: async () => {
          const credentials = await ensureCredentials({ interactive: false, log: () => {} });
          return { client: new GalaxyClient(credentials), selfId: credentials.selfId };
        },
        onPhase: (phase) => {
          if (phase.phase === "checking") {
            const { runId } = phase;
            status = { ...status, runId, state: "checking", done: 0, total: 0 };
          } else {
            const { done, total } = phase;
            status = { ...status, state: "fetching", done, total };
          }
        },
      });
      status = { ...status, state: "done", done: status.total, newBlunders, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status = { ...status, state: "error", newBlunders: 0, error: message };
    } finally {
      db.close();
    }
  }

  return {
    /**
     * Starts a run in the background, unless one is running, or this is a page
     * load and another started moments ago.
     */
    start(trigger: SyncTrigger): void {
      if (running || !(SYNC_INTERVAL_MS > 0)) return;
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
