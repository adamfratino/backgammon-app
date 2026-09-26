import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

process.env.BLUNDERS_DB_PATH = join(mkdtempSync(join(tmpdir(), "galaxy-scraper-auth-")), "x.db");
const { ensureCredentials, LoginRequiredError } = await import("./auth.ts");

const jwt = (payload: object): string =>
  `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

test("asks for a login instead of prompting when it can't prompt", async () => {
  process.env.GALAXY_TOKEN = jwt({ typ: "Bearer", exp: Date.now() / 1000 - 60 });
  await assert.rejects(
    ensureCredentials({ interactive: false, log: () => {} }),
    LoginRequiredError,
  );
});

test("uses a stored token that is still good", async () => {
  const token = jwt({ typ: "Bearer", exp: Date.now() / 1000 + 3600 });
  process.env.GALAXY_TOKEN = token;
  assert.equal((await ensureCredentials({ interactive: false, log: () => {} })).token, token);
});
