import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(here, "..");
export const RAW_DIR = join(PACKAGE_ROOT, "raw");
export const DATA_DIR = join(PACKAGE_ROOT, "data");
export const DB_PATH = join(DATA_DIR, "blunders.db");

export const API_BASE = "https://api.backgammongalaxy.com/blunder-service/api/v1";

/**
 * Categories as of the last observed `categories` response. Used only as a
 * fallback when the live categories endpoint cannot be reached. `recent` is
 * excluded by default because it re-lists blunders already filed elsewhere.
 */
export const KNOWN_CATEGORIES = [
  "attacking_game",
  "blitz",
  "close_out",
  "crunching_game",
  "deep_anchor_game",
  "early_backgame",
  "early_blitz",
  "end_game_contact",
  "holding_game",
  "late_backgame",
  "late_game_hit",
  "middle_game",
  "mutual_holding_game",
  "one_man_back",
  "opening_game",
  "race",
  "six_prime",
];

export const CROSS_CUTTING_CATEGORIES = new Set(["recent"]);
