import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(here, "..");

/**
 * The database, and everything that has to be shared along with it: the Galaxy
 * login, the raw pages and the sync lock. A worktree has no database of its own,
 * so `BLUNDERS_DB_PATH` points it at the main checkout's (see
 * `scripts/setup-worktree.ts`), and the rest follows it there.
 */
export const DB_PATH = process.env.BLUNDERS_DB_PATH ?? join(PACKAGE_ROOT, "data", "blunders.db");
export const DATA_DIR = dirname(DB_PATH);
export const RAW_DIR = join(DATA_DIR, "raw");

export const API_BASE = "https://api.backgammongalaxy.com";

/** Galaxy's Keycloak realm; `account` is the public client the web app itself uses. */
export const KEYCLOAK_TOKEN_URL =
  "https://auth.backgammongalaxy.com/realms/backgammongalaxy/protocol/openid-connect/token";
export const KEYCLOAK_CLIENT_ID = "account";

/** Galaxy's edge rejects non-browser user agents, so every request pretends to be Chrome. */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

/** Version the web client reports; see https://www.backgammongalaxy.com/play/version.json */
export const APP_VERSION = "6.0.216+666";
