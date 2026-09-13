import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "@repo/galaxy-scraper/config";

import { createSqliteNotesStore, type NotesStore } from "@/server/notes";

const BLUNDERS_DB_PATH = process.env.BLUNDERS_DB_PATH ?? DB_PATH;

// Next.js reloads modules on every edit in dev; cache on globalThis so we open
// the file once instead of leaking a handle per reload.
const globalForDb = globalThis as { db?: DatabaseSync; notes?: NotesStore };

/** The scraped blunders. Read-only, so nothing a request does can change them. */
export const db: DatabaseSync = (globalForDb.db ??= new DatabaseSync(BLUNDERS_DB_PATH, {
  readOnly: true,
}));

/**
 * Notes are the one thing here a re-scrape can't bring back, so they live in
 * their own file beside whichever `blunders.db` is open. Every worktree points at
 * the main checkout's, so every checkout shares one notes file there.
 */
export const notes: NotesStore = (globalForDb.notes ??= createSqliteNotesStore(
  process.env.NOTES_DB_PATH ?? join(dirname(BLUNDERS_DB_PATH), "notes.db"),
));
