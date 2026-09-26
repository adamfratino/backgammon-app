import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

// The paths are fixed when config.ts is imported, so point it at a scratch checkout first.
const checkout = mkdtempSync(join(tmpdir(), "galaxy-scraper-"));
const dataDir = join(checkout, "data");
process.env.BLUNDERS_DB_PATH = join(dataDir, "blunders.db");
delete process.env.GALAXY_TOKEN;

const { DATA_DIR, RAW_DIR } = await import("./config.ts");
const { AUTH_FILE, readStoredCredentials, saveCredentials } = await import("./credentials.ts");

const jwt = (payload: object): string =>
  `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

test("everything shared lives beside BLUNDERS_DB_PATH", () => {
  assert.equal(DATA_DIR, dataDir);
  assert.equal(RAW_DIR, join(dataDir, "raw"));
  assert.equal(AUTH_FILE, join(dataDir, ".auth.json"));
});

test("reads a login from where .auth.json used to be, and saves it to where it is now", () => {
  const old = jwt({ typ: "Bearer", bg_id: "old" });
  writeFileSync(join(checkout, ".auth.json"), JSON.stringify({ accessToken: old }));
  assert.equal(readStoredCredentials()?.token, old);

  const renewed = jwt({ typ: "Bearer", bg_id: "new" });
  saveCredentials(renewed, null);
  assert.ok(existsSync(AUTH_FILE));
  assert.equal(JSON.parse(readFileSync(AUTH_FILE, "utf8")).accessToken, renewed);
  assert.equal(readStoredCredentials()?.selfId, "new");
});
