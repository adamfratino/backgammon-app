import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { BlunderEvent, CategoryPage } from "./types.ts";

// Raw pages land beside the database, so keep them out of the real one's folder.
process.env.BLUNDERS_DB_PATH = join(mkdtempSync(join(tmpdir(), "galaxy-scraper-sync-")), "x.db");
const { openDatabase, writeBatch } = await import("./db.ts");
const { normalize } = await import("./transform.ts");
const { syncIncremental } = await import("./sync.ts");
type SyncPhase = import("./sync.ts").SyncPhase;

/** The least `normalize` accepts as a flagged checker blunder. */
const event = (blunder_id: number): BlunderEvent =>
  ({
    blunder_id,
    match_id: 1,
    type: "event",
    event: {
      event_type: "move_commited",
      reviews: [{ result: { error_analysis: { is_blunder: true } } }],
    },
    match: { data: { id: 1, type: "match", attributes: { length: 5, status: "finished" } } },
  }) as unknown as BlunderEvent;

/** `count` ids counting down from `from`, as Galaxy lists them. */
const ids = (from: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => from - i);

function fakeGalaxy(pages: Record<string, number[][]>) {
  const requests: string[] = [];
  return {
    requests,
    client: {
      async fetchCategories() {
        requests.push("categories");
        const counts = Object.fromEntries(Object.keys(pages).map((c) => [c, 1]));
        return { counts, path: "/blunder/categories" };
      },
      async fetchCategoryPage(category: string, page: number): Promise<CategoryPage> {
        requests.push(`${category}/${page}`);
        const events = (pages[category]?.[page - 1] ?? []).map(event);
        return { type: "page", data: { events } };
      },
    },
  };
}

function databaseWith(...blunderIds: number[]) {
  const db = openDatabase(":memory:");
  writeBatch(db, normalize(blunderIds.map(event), "seed", null));
  return db;
}

async function run(db: ReturnType<typeof databaseWith>, pages: Record<string, number[][]>) {
  const galaxy = fakeGalaxy(pages);
  const phases: SyncPhase["phase"][] = [];
  const result = await syncIncremental(galaxy.client, db, {
    selfId: null,
    onPhase: ({ phase }) => phases.push(phase),
  });
  return { ...result, requests: galaxy.requests, phases };
}

test("nothing new: one request, and no scraping", async () => {
  const synced = await run(databaseWith(1000), {
    recent: [ids(1000, 100)],
    blitz: [ids(1000, 100)],
  });
  assert.deepEqual(synced.requests, ["recent/1"]);
  assert.deepEqual(synced.phases, ["checking", "done"]);
  assert.equal(synced.newBlunders, 0);
});

test("new blunders on page 1: one page per category", async () => {
  const synced = await run(databaseWith(1000), {
    recent: [ids(1050, 100)],
    blitz: [ids(1050, 100), ids(950, 100)],
    race: [ids(1020, 100), ids(920, 100)],
  });
  assert.deepEqual(synced.requests, ["recent/1", "categories", "blitz/1", "race/1"]);
  assert.deepEqual(synced.phases, ["checking", "scraping", "scraping", "done"]);
});

test("a known id on page 2 stops the category there", async () => {
  const synced = await run(databaseWith(1000), {
    recent: [ids(1250, 100)],
    blitz: [ids(1250, 100), ids(1050, 100), ids(950, 100)],
  });
  assert.deepEqual(synced.requests, ["recent/1", "categories", "blitz/1", "blitz/2"]);
});

test("a short page is the last one", async () => {
  const synced = await run(openDatabase(":memory:"), {
    recent: [ids(40, 40)],
    blitz: [ids(40, 40)],
  });
  assert.deepEqual(synced.requests, ["recent/1", "categories", "blitz/1"]);
  assert.equal(synced.newBlunders, 40);
});

test("counts only blunders the database didn't have", async () => {
  const synced = await run(databaseWith(1000, 990), {
    recent: [ids(1050, 100)],
    blitz: [ids(1050, 100)],
    race: [ids(1020, 100)],
  });
  assert.equal(synced.newBlunders, 50);
});
