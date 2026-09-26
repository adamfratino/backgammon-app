/**
 * Keeps the blunders current while the server runs: a sync on boot, then one
 * every `SYNC_INTERVAL_MS`. Neither is awaited, since `register` has to return
 * before the server takes requests.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { sync, SYNC_INTERVAL_MS } = await import("@/server/sync");
  if (!(SYNC_INTERVAL_MS > 0)) return;

  // `register` can run again in dev; one interval per server is enough.
  const globalForSync = globalThis as { syncInterval?: NodeJS.Timeout };
  if (globalForSync.syncInterval) return;

  sync.start("boot");
  globalForSync.syncInterval = setInterval(() => sync.start("interval"), SYNC_INTERVAL_MS);
}
