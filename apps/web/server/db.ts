import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "@repo/galaxy-scraper/config";

import { leadOf, matchPointsOf } from "@/lib/score";
import { crawfordFilterOf } from "@/server/crawford";
import { createSqliteNotesStore, type NotesStore } from "@/server/notes";

/** SQLite hands a function whatever the column held, which may be any type. */
const asNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);
const asText = (value: unknown): string | null => (typeof value === "string" ? value : null);

// Next.js reloads modules on every edit in dev; cache on globalThis so we open
// the file once instead of leaking a handle per reload.
const globalForDb = globalThis as { db?: DatabaseSync; notes?: NotesStore };

/**
 * SQL has no way to pick a field out of an XGID, so the rules that need one are
 * applied in JS and handed to SQLite as functions — which lets the list filter
 * on them where it filters on everything else, in one query with one count and
 * one page. Each reads columns and returns a value, so they stay safe on a
 * read-only handle.
 */
function openBlunders(): DatabaseSync {
  const database = new DatabaseSync(DB_PATH, { readOnly: true });

  database.function("crawford_filter", { deterministic: true }, (xgid) =>
    crawfordFilterOf(asText(xgid)),
  );

  // Both of these prefer the columns and reach for the XGID only where the
  // scraper left them null, which is why each takes the row rather than just
  // the string — see `leadOf`.
  database.function("score_lead", { deterministic: true }, (black, white, xgid) =>
    leadOf(asNumber(black), asNumber(white), asText(xgid)),
  );

  database.function("match_points", { deterministic: true }, (length, xgid) =>
    matchPointsOf(asNumber(length), asText(xgid)),
  );

  return database;
}

/** The scraped blunders. Read-only, so nothing a request does can change them. */
export const db: DatabaseSync = (globalForDb.db ??= openBlunders());

/**
 * Notes are the one thing here a re-scrape can't bring back, so they live in
 * their own file beside whichever `blunders.db` is open. Every worktree points at
 * the main checkout's, so every checkout shares one notes file there.
 */
export const notes: NotesStore = (globalForDb.notes ??= createSqliteNotesStore(
  process.env.NOTES_DB_PATH ?? join(dirname(DB_PATH), "notes.db"),
));
