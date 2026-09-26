import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.ts";

/**
 * Held for a whole sync, token renewal included. Every dev server and a manual
 * `pnpm blunders` share it, because they share the database and the login: two
 * renewals racing on one refresh token can leave `.auth.json` holding the loser.
 */
export const LOCK_FILE = join(DATA_DIR, "sync.lock");

/** Longer than any sync takes, so a lock this old was left by a run that died. */
const STALE_AFTER_MS = 10 * 60_000;

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: it exists, it just isn't ours to signal.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

const holderPid = (): number | null => {
  try {
    const { pid } = JSON.parse(readFileSync(LOCK_FILE, "utf8")) as { pid?: unknown };
    return typeof pid === "number" ? pid : null;
  } catch {
    return null;
  }
};

function isStale(): boolean {
  // A lock that can't be read yet is mid-write, so only its age can condemn it.
  const pid = holderPid();
  if (pid !== null && !isAlive(pid)) return true;
  return Date.now() - statSync(LOCK_FILE).mtimeMs > STALE_AFTER_MS;
}

function create(holder: string): boolean {
  try {
    writeFileSync(LOCK_FILE, holder, { flag: "wx" });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

/**
 * Runs `fn` holding the sync lock, or returns null without running it when
 * another live process holds it.
 */
export async function withSyncLock<T>(fn: () => Promise<T>): Promise<T | null> {
  mkdirSync(DATA_DIR, { recursive: true });
  const holder = JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() });

  if (!create(holder)) {
    if (!isStale()) return null;
    rmSync(LOCK_FILE, { force: true });
    if (!create(holder)) return null;
  }

  try {
    return await fn();
  } finally {
    // A run slow enough to be taken over must not delete its successor's lock.
    try {
      if (readFileSync(LOCK_FILE, "utf8") === holder) rmSync(LOCK_FILE);
    } catch {
      // Already gone.
    }
  }
}
