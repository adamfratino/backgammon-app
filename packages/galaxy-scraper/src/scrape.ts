import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PermanentError, type GalaxyClient } from "./api.ts";
import { CROSS_CUTTING_CATEGORIES, KNOWN_CATEGORIES, RAW_DIR } from "./config.ts";
import type { CategoryPage } from "./types.ts";

export interface ScrapeOptions {
  categories?: string[];
  includeRecent?: boolean;
  /** Reuse already-downloaded pages instead of refetching. */
  resume?: boolean;
  maxPages?: number;
  onProgress?: (message: string) => void;
}

const pagePath = (category: string, page: number): string =>
  join(RAW_DIR, category, `page-${String(page).padStart(3, "0")}.json`);

/**
 * Walks a category's pages until one comes back empty or stops yielding
 * blunder ids we haven't already seen. The API exposes no page count, so
 * exhaustion is the only stop signal.
 */
export async function scrapeCategory(
  client: GalaxyClient,
  category: string,
  options: ScrapeOptions = {},
): Promise<{ pages: number; blunders: number }> {
  const maxPages = options.maxPages ?? 100;
  const log = options.onProgress ?? (() => {});
  mkdirSync(join(RAW_DIR, category), { recursive: true });

  const seen = new Set<number>();
  let pages = 0;

  for (let page = 1; page <= maxPages; page++) {
    const file = pagePath(category, page);
    let payload: CategoryPage;

    if (options.resume && existsSync(file)) {
      payload = JSON.parse(readFileSync(file, "utf8")) as CategoryPage;
    } else {
      try {
        payload = await client.fetchCategoryPage(category, page);
      } catch (error) {
        // Some categories answer 404 rather than an empty page once exhausted.
        if (error instanceof PermanentError && error.status === 404) {
          log(`  ${category}: page ${page} not found — done`);
          break;
        }
        throw error;
      }
      writeFileSync(file, JSON.stringify(payload, null, 2));
    }

    const events = payload?.data?.events ?? [];
    if (events.length === 0) {
      log(`  ${category}: page ${page} empty — done`);
      break;
    }

    const before = seen.size;
    for (const event of events) seen.add(event.blunder_id);
    pages = page;

    log(`  ${category}: page ${page} → ${events.length} events, ${seen.size} blunders`);

    // A page that adds nothing new means the API is repeating itself.
    if (seen.size === before) {
      log(`  ${category}: page ${page} added no new blunders — done`);
      break;
    }
  }

  return { pages, blunders: seen.size };
}

export function resolveCategories(counts: Record<string, number> | null, options: ScrapeOptions): string[] {
  const all = counts ? Object.keys(counts) : KNOWN_CATEGORIES;
  const requested = options.categories?.length ? options.categories : all;
  return requested.filter((c) => options.includeRecent || !CROSS_CUTTING_CATEGORIES.has(c));
}

/** Reads every cached page back off disk, newest categories first. */
export function readRawPages(): { category: string; payload: CategoryPage }[] {
  if (!existsSync(RAW_DIR)) return [];
  const out: { category: string; payload: CategoryPage }[] = [];

  for (const category of readdirSync(RAW_DIR)) {
    const dir = join(RAW_DIR, category);
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    } catch {
      continue;
    }
    for (const file of files) {
      try {
        out.push({ category, payload: JSON.parse(readFileSync(join(dir, file), "utf8")) as CategoryPage });
      } catch {
        // Skip a half-written page rather than aborting the whole load.
      }
    }
  }

  return out;
}
