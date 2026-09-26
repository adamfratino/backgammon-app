import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const dataDir = mkdtempSync(join(tmpdir(), "galaxy-scraper-lock-"));
process.env.BLUNDERS_DB_PATH = join(dataDir, "blunders.db");

const { LOCK_FILE, withSyncLock } = await import("./lock.ts");

const hold = (pid: number): void =>
  writeFileSync(LOCK_FILE, JSON.stringify({ pid, startedAt: new Date().toISOString() }));

test("runs, then releases the lock", async () => {
  assert.equal(await withSyncLock(async () => "ran"), "ran");
  assert.equal(existsSync(LOCK_FILE), false);
});

test("skips while a live process holds the lock", async () => {
  hold(process.pid);
  assert.equal(await withSyncLock(async () => "ran"), null);
  assert.equal(existsSync(LOCK_FILE), true);
});

test("takes over a lock whose process has died", async () => {
  hold(spawnSync("true").pid);
  assert.equal(await withSyncLock(async () => "ran"), "ran");
});

test("takes over a lock older than ten minutes", async () => {
  hold(process.pid);
  const old = new Date(Date.now() - 11 * 60_000);
  utimesSync(LOCK_FILE, old, old);
  assert.equal(await withSyncLock(async () => "ran"), "ran");
});

test("releases the lock when the run throws", async () => {
  await assert.rejects(
    withSyncLock(async () => {
      throw new Error("boom");
    }),
  );
  assert.equal(existsSync(LOCK_FILE), false);
});
