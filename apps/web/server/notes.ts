import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** A note on one blunder. `updated_at` is ISO 8601, stamped by the store on every save. */
export interface Note {
  blunder_id: number;
  body: string;
  updated_at: string;
}

/**
 * Everything the app may do with notes, and all the router knows about where
 * they live. Every method returns a Promise even though `node:sqlite` is
 * synchronous: Supabase and IndexedDB are async-only, so a synchronous interface
 * would change every caller on the day the store moves.
 */
export interface NotesStore {
  get(blunderId: number): Promise<Note | null>;
  /** Creates or replaces the note, and returns what is now stored. */
  save(blunderId: number, body: string): Promise<Note>;
  remove(blunderId: number): Promise<void>;
  /** Every blunder that has a note. */
  ids(): Promise<number[]>;
}

/**
 * One row per blunder, keyed by Galaxy's own `blunder_id`, which survives a
 * re-scrape. There is deliberately no foreign key to `blunders`: the scraper
 * writes that table with `INSERT OR REPLACE`, which deletes before it inserts,
 * so an `ON DELETE CASCADE` would wipe every note on every `load`. A note whose
 * blunder is gone is simply never shown.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS notes (
    blunder_id INTEGER PRIMARY KEY,
    body       TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`;

export function createSqliteNotesStore(path: string): NotesStore {
  let db: DatabaseSync | undefined;

  // Opened on first use rather than on import: `/` is prerendered at build time
  // and imports the context, and a build should not create a notes file.
  const open = (): DatabaseSync => {
    if (db) return db;
    mkdirSync(dirname(path), { recursive: true });
    db = new DatabaseSync(path);
    // Every checkout's dev server may share this file. WAL keeps one server's
    // write from blocking another's reads.
    db.exec("PRAGMA journal_mode = WAL");
    db.exec(SCHEMA);
    return db;
  };

  return {
    async get(blunderId) {
      const row = open()
        .prepare("SELECT blunder_id, body, updated_at FROM notes WHERE blunder_id = ?")
        .get(blunderId);
      return row ? (row as unknown as Note) : null;
    },

    async save(blunderId, body) {
      const note: Note = { blunder_id: blunderId, body, updated_at: new Date().toISOString() };
      // An upsert. The same statement is valid Postgres, with `$1` in place of `?`.
      open()
        .prepare(
          `INSERT INTO notes (blunder_id, body, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (blunder_id) DO UPDATE
           SET body = excluded.body, updated_at = excluded.updated_at`,
        )
        .run(note.blunder_id, note.body, note.updated_at);
      return note;
    },

    async remove(blunderId) {
      open().prepare("DELETE FROM notes WHERE blunder_id = ?").run(blunderId);
    },

    async ids() {
      return open()
        .prepare("SELECT blunder_id FROM notes ORDER BY blunder_id")
        .all()
        .map((row) => row.blunder_id as number);
    },
  };
}
