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
const { scrapeCategory } = await import("./scrape.ts");
const { recordFullSync, syncIncremental } = await import("./sync.ts");

/** The least `normalize` accepts as a flagged checker blunder, or, unreviewed, one it drops. */
const event = (blunder_id: number, reviewed = true): BlunderEvent =>
  ({
    blunder_id,
    match_id: 1,
    type: "event",
    event: {
      event_type: "move_commited",
      reviews: reviewed ? [{ result: { error_analysis: { is_blunder: true } } }] : [],
    },
    match: { data: { id: 1, type: "match", attributes: { length: 5, status: "finished" } } },
  }) as unknown as BlunderEvent;

/** `count` ids counting down from `from`, as Galaxy lists them. */
const ids = (from: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => from - i);

interface Galaxy {
  pages: Record<string, number[][]>;
  /** A `category/page` request that fails, as a 503 or a dropped connection would. */
  fail?: string;
  /** Ids Galaxy lists without a review, which `normalize` drops. */
  unreviewed?: number[];
}

function fakeGalaxy({ pages, fail, unreviewed = [] }: Galaxy) {
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
        const key = `${category}/${page}`;
        requests.push(key);
        if (key === fail) throw new Error(`HTTP 503 on ${key}`);
        const events = (pages[category]?.[page - 1] ?? []).map((id) =>
          event(id, !unreviewed.includes(id)),
        );
        return { type: "page", data: { events } };
      },
    },
  };
}

function databaseWith(...blunderIds: number[]) {
  const db = openDatabase(":memory:");
  writeBatch(
    db,
    normalize(
      blunderIds.map((id) => event(id)),
      "seed",
      null,
    ),
  );
  return db;
}

type Database = ReturnType<typeof databaseWith>;

async function run(db: Database, galaxy: Galaxy) {
  const fake = fakeGalaxy(galaxy);
  const phases: string[] = [];
  const result = await syncIncremental(db, {
    trigger: "test",
    connect: async () => ({ client: fake.client, selfId: null }),
    onPhase: ({ phase }) => phases.push(phase),
  });
  return { ...result, requests: fake.requests, phases };
}

const count = (db: Database, sql: string): number => (db.prepare(sql).get() as { n: number }).n;

test("nothing new: one request, and no scraping", async () => {
  const synced = await run(databaseWith(1000), {
    pages: { recent: [ids(1000, 100)], blitz: [ids(1000, 100)] },
  });
  assert.deepEqual(synced.requests, ["recent/1"]);
  assert.deepEqual(synced.phases, ["checking"]);
  assert.equal(synced.newBlunders, 0);
});

test("new blunders on page 1: one page per category", async () => {
  const synced = await run(databaseWith(1000), {
    pages: {
      recent: [ids(1050, 100)],
      blitz: [ids(1050, 100), ids(950, 100)],
      race: [ids(1020, 100), ids(920, 100)],
    },
  });
  assert.deepEqual(synced.requests, ["recent/1", "categories", "blitz/1", "race/1"]);
  assert.deepEqual(synced.phases, ["checking", "scraping", "scraping"]);
});

test("a known id on page 2 stops the category there", async () => {
  const synced = await run(databaseWith(1000), {
    pages: {
      recent: [ids(1250, 100)],
      blitz: [ids(1250, 100), ids(1050, 100), ids(950, 100)],
    },
  });
  assert.deepEqual(synced.requests, ["recent/1", "categories", "blitz/1", "blitz/2"]);
});

test("a short page is the last one", async () => {
  const synced = await run(openDatabase(":memory:"), {
    pages: { recent: [ids(40, 40)], blitz: [ids(40, 40)] },
  });
  assert.deepEqual(synced.requests, ["recent/1", "categories", "blitz/1"]);
  assert.equal(synced.newBlunders, 40);
});

test("counts only blunders the database didn't have", async () => {
  const synced = await run(databaseWith(1000, 990), {
    pages: { recent: [ids(1050, 100)], blitz: [ids(1050, 100)], race: [ids(1020, 100)] },
  });
  assert.equal(synced.newBlunders, 50);
});

test("a run that fails partway leaves the next to fetch what it missed", async () => {
  const db = databaseWith(1000);
  const pages = {
    recent: [ids(1050, 100)],
    blitz: [ids(1050, 100)],
    race: [[...ids(1020, 10), ...ids(1000, 90)]],
  };
  await assert.rejects(run(db, { pages, fail: "race/1" }), /503/);
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM sync_runs WHERE error IS NOT NULL"), 1);

  const retried = await run(db, { pages });
  assert.deepEqual(retried.requests, ["recent/1", "categories", "blitz/1", "race/1"]);
  assert.equal(
    count(db, "SELECT COUNT(*) AS n FROM blunder_categories WHERE category = 'race'"),
    10,
  );
});

test("a blunder Galaxy lists but the database can't keep doesn't make every run rescan", async () => {
  const db = databaseWith(1000);
  const galaxy = {
    pages: { recent: [ids(1001, 100)], blitz: [ids(1001, 100)] },
    unreviewed: [1001],
  };
  await run(db, galaxy);
  const again = await run(db, galaxy);
  assert.deepEqual(again.requests, ["recent/1"]);
});

test("leaves the rows it already had alone", async () => {
  const db = databaseWith(1000);
  // Stands in for a column only a newer checkout fills, which a rewrite from this one would blank.
  db.exec("UPDATE blunders SET played_notation = 'kept' WHERE blunder_id = 1000");
  await run(db, { pages: { recent: [ids(1050, 100)], blitz: [ids(1050, 100)] } });
  assert.equal(count(db, "SELECT COUNT(*) AS n FROM blunders WHERE played_notation = 'kept'"), 1);
});

test("a full walk doesn't come back as new", async () => {
  const db = databaseWith(1000, 1050);
  db.exec(
    "INSERT INTO sync_runs (trigger, started_at, finished_at, high_water) VALUES ('test', '', '', 1000)",
  );
  recordFullSync(db);
  const synced = await run(db, { pages: { recent: [ids(1050, 100)], blitz: [ids(1050, 100)] } });
  assert.deepEqual(synced.requests, ["recent/1"]);
});

test("a page that shifted mid-walk isn't mistaken for the last", async () => {
  const fake = fakeGalaxy({
    pages: { blitz: [ids(300, 100), [201, ...ids(199, 99)], ids(100, 100), []] },
  });
  await scrapeCategory(fake.client, "blitz");
  assert.deepEqual(fake.requests, ["blitz/1", "blitz/2", "blitz/3", "blitz/4"]);
});
