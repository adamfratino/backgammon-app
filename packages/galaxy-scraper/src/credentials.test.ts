import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePastedCredentials } from "./credentials.ts";

const jwt = (payload: object): string =>
  `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

const access = jwt({ typ: "Bearer", bg_id: "me" });
const refresh = jwt({ typ: "Refresh" });

test("tells the tokens apart by their typ claim, in either order", () => {
  assert.deepEqual(parsePastedCredentials(`${refresh} ${access}`), {
    token: access,
    refreshToken: refresh,
  });
});

test("reads the console snippet's JSON", () => {
  assert.deepEqual(parsePastedCredentials(JSON.stringify({ access, refresh })), {
    token: access,
    refreshToken: refresh,
  });
});

test("returns null when there is no access token", () => {
  assert.equal(parsePastedCredentials(refresh), null);
  assert.equal(parsePastedCredentials("nope"), null);
});
