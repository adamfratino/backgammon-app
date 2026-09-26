import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DATA_DIR, PACKAGE_ROOT } from "./config.ts";

/** Where `login` saves the access and refresh token pair. Gitignored. */
export const AUTH_FILE = join(DATA_DIR, ".auth.json");

/** Where `AUTH_FILE` used to live: the package root of the checkout holding the database. */
const LEGACY_AUTH_FILE = join(dirname(DATA_DIR), ".auth.json");

/** Legacy single-token files, still honoured so an existing setup keeps working. */
const LEGACY_TOKEN_FILES = [join(PACKAGE_ROOT, ".token"), resolve(PACKAGE_ROOT, "../../.token")];

const JWT_SHAPE = /^[\w-]+\.[\w-]+\.[\w-]+$/;

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  if (!JWT_SHAPE.test(token)) return null;
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function jwtExpiry(token: string | null): Date | null {
  if (!token) return null;
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === "number" ? new Date(exp * 1000) : null;
}

const isJwt = (value: string): boolean => decodeJwtPayload(value) !== null;

export interface Credentials {
  token: string;
  /** Keycloak refresh token, when the login captured one. Lets the CLI renew `token` itself. */
  refreshToken: string | null;
  /** Galaxy user id (`bg_id` claim) — identifies which player in a match is you. */
  selfId: string | null;
  expiresAt: Date | null;
  refreshExpiresAt: Date | null;
}

export function describeCredentials(token: string, refreshToken: string | null): Credentials {
  const payload = decodeJwtPayload(token);
  return {
    token,
    refreshToken,
    selfId: typeof payload?.bg_id === "string" ? payload.bg_id : null,
    expiresAt: jwtExpiry(token),
    refreshExpiresAt: jwtExpiry(refreshToken),
  };
}

export const isExpired = (at: Date | null): boolean => at !== null && at.getTime() < Date.now();

export const daysUntil = (at: Date): number => (at.getTime() - Date.now()) / 86_400_000;

/**
 * Accepts whatever the console snippet or a human is likely to paste: the snippet's
 * `{"access":…,"refresh":…}` JSON, a bare JWT, `Bearer <jwt>`, or two JWTs separated by
 * whitespace. Tokens are told apart by their `typ` claim, so order does not matter.
 */
export function parsePastedCredentials(
  input: string,
): { token: string; refreshToken: string | null } | null {
  const text = input.replace(/\u001b\[20[01]~/g, "").trim();
  if (!text) return null;

  const candidates: string[] = [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object") {
      for (const value of Object.values(parsed)) {
        if (typeof value === "string") candidates.push(value);
      }
    } else if (typeof parsed === "string") {
      candidates.push(parsed);
    }
  } catch {
    candidates.push(...text.replace(/^Bearer\s+/i, "").split(/[\s,"']+/));
  }

  let token: string | null = null;
  let refreshToken: string | null = null;
  for (const candidate of candidates) {
    const cleaned = candidate.replace(/^Bearer\s+/i, "").trim();
    if (!isJwt(cleaned)) continue;
    const typ = decodeJwtPayload(cleaned)?.typ;
    if (typ === "Refresh" || typ === "Offline") refreshToken ??= cleaned;
    else token ??= cleaned;
  }
  return token ? { token, refreshToken } : null;
}

export function saveCredentials(token: string, refreshToken: string | null): void {
  mkdirSync(DATA_DIR, { recursive: true });
  // Every sync renews the login, so a restart can land mid-write. Writing beside
  // the file and renaming over it means a crash leaves the old login, not half of one.
  const pending = `${AUTH_FILE}.pending`;
  writeFileSync(
    pending,
    JSON.stringify(
      { accessToken: token, refreshToken, savedAt: new Date().toISOString() },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
  chmodSync(pending, 0o600);
  renameSync(pending, AUTH_FILE);
}

/**
 * Whatever credentials are on disk, valid or not: `$GALAXY_TOKEN`, then `.auth.json`
 * (where it is now, then where it was), then a legacy `.token` file. Returns null when
 * there is nothing at all.
 */
export function readStoredCredentials(): Credentials | null {
  const env = process.env.GALAXY_TOKEN?.trim().replace(/^Bearer\s+/i, "");
  if (env) return describeCredentials(env, null);

  // The web app bundles this module. Every path here is decided at runtime, so
  // `turbopackIgnore` stops Turbopack tracing the whole project to cover them.

  // The next save moves a legacy file's tokens to `AUTH_FILE`.
  for (const file of [AUTH_FILE, LEGACY_AUTH_FILE]) {
    if (!existsSync(/*turbopackIgnore: true*/ file)) continue;
    try {
      const saved = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as {
        accessToken?: string;
        refreshToken?: string | null;
      };
      if (saved.accessToken)
        return describeCredentials(saved.accessToken, saved.refreshToken ?? null);
    } catch {
      // A corrupt file is treated as no credentials; login rewrites it.
    }
  }

  for (const file of LEGACY_TOKEN_FILES) {
    if (!existsSync(/*turbopackIgnore: true*/ file)) continue;
    const token = readFileSync(/*turbopackIgnore: true*/ file, "utf8")
      .trim()
      .replace(/^Bearer\s+/i, "");
    if (token) return describeCredentials(token, null);
  }
  return null;
}

/**
 * Stored credentials with a usable access token, or throws. Non-interactive: for the
 * refresh-or-prompt flow use `ensureCredentials` in `auth.ts`.
 */
export function loadCredentials(): Credentials {
  const credentials = readStoredCredentials();
  if (!credentials) {
    throw new Error(
      `No Galaxy credentials found. Run "pnpm blunders" (or "pnpm --filter @repo/galaxy-scraper login") to capture them.`,
    );
  }
  if (isExpired(credentials.expiresAt)) {
    throw new Error(
      `Galaxy token expired at ${credentials.expiresAt?.toISOString()}. Run "pnpm blunders" to renew it.`,
    );
  }
  return credentials;
}
