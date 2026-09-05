import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { PACKAGE_ROOT } from "./config.ts";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface Credentials {
  token: string;
  /** Galaxy user id (`bg_id` claim) — identifies which player in a match is you. */
  selfId: string | null;
  expiresAt: Date | null;
}

/**
 * Resolves the bearer token from $GALAXY_TOKEN, then a `.token` file in the
 * package root, then one at the monorepo root. Both files are gitignored.
 */
export function loadCredentials(): Credentials {
  const candidates = [
    join(PACKAGE_ROOT, ".token"),
    resolve(PACKAGE_ROOT, "../../.token"),
  ];

  let raw = process.env.GALAXY_TOKEN ?? "";
  if (!raw) {
    for (const file of candidates) {
      if (existsSync(file)) {
        raw = readFileSync(file, "utf8");
        break;
      }
    }
  }

  const token = raw.trim().replace(/^Bearer\s+/i, "");
  if (!token) {
    throw new Error(
      `No Galaxy token found. Set GALAXY_TOKEN, or write the bearer token to:\n  ${candidates[0]}`,
    );
  }

  const payload = decodeJwtPayload(token);
  const exp =
    typeof payload?.exp === "number" ? new Date(payload.exp * 1000) : null;
  if (exp && exp.getTime() < Date.now()) {
    throw new Error(
      `Galaxy token expired at ${exp.toISOString()}. Grab a fresh one from DevTools.`,
    );
  }

  return {
    token,
    selfId: typeof payload?.bg_id === "string" ? payload.bg_id : null,
    expiresAt: exp,
  };
}
