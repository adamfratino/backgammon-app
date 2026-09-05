import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "@repo/galaxy-scraper/config";

// Next.js reloads modules on every edit in dev; cache on globalThis so we open
// the file once instead of leaking a handle per reload.
const globalForDb = globalThis as { db?: DatabaseSync };

export const db: DatabaseSync = (globalForDb.db ??= new DatabaseSync(
  process.env.BLUNDERS_DB_PATH ?? DB_PATH,
  { readOnly: true },
));
