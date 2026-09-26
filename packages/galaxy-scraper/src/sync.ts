import type { DatabaseSync } from "node:sqlite";
import type { GalaxyClient } from "./api.ts";
import { writeBatch } from "./db.ts";
import { resolveCategories, scrapeCategory } from "./scrape.ts";
import { normalize } from "./transform.ts";

export type SyncPhase =
  | { phase: "checking" }
  | { phase: "scraping"; category: string; done: number; total: number }
  | { phase: "done"; newBlunders: number };

export interface SyncOptions {
  /** The account holder's Galaxy id, which decides who is "self" in each match. */
  selfId: string | null;
  onPhase?: (phase: SyncPhase) => void;
  onProgress?: (message: string) => void;
}

const maxBlunderId = (db: DatabaseSync): number =>
  (db.prepare("SELECT COALESCE(MAX(blunder_id), 0) AS id FROM blunders").get() as { id: number })
    .id;

/**
 * Fetches only what Galaxy has added since the last sync. Every category lists
 * its blunders newest first, and ids only grow, so one page of `recent` says
 * whether there is anything new at all, and each category can stop at the first
 * page holding an id the database already has.
 */
export async function syncIncremental(
  client: Pick<GalaxyClient, "fetchCategories" | "fetchCategoryPage">,
  db: DatabaseSync,
  { selfId, onPhase = () => {}, onProgress }: SyncOptions,
): Promise<{ newBlunders: number }> {
  onPhase({ phase: "checking" });
  const known = maxBlunderId(db);
  const isKnown = (event: { blunder_id: number }): boolean => event.blunder_id <= known;

  const recent = (await client.fetchCategoryPage("recent", 1))?.data?.events ?? [];
  if (recent.every(isKnown)) {
    onPhase({ phase: "done", newBlunders: 0 });
    return { newBlunders: 0 };
  }

  const categories = resolveCategories((await client.fetchCategories())?.counts ?? null, {});
  for (const [done, category] of categories.entries()) {
    onPhase({ phase: "scraping", category, done, total: categories.length });
    await scrapeCategory(client, category, {
      onProgress,
      onPage: (events) => writeBatch(db, normalize(events, category, selfId)),
      stopAfter: (events) => events.some(isKnown),
    });
  }

  const { n: newBlunders } = db
    .prepare("SELECT COUNT(*) AS n FROM blunders WHERE blunder_id > ?")
    .get(known) as { n: number };
  onPhase({ phase: "done", newBlunders });
  return { newBlunders };
}
