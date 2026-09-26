#!/usr/bin/env node
import { GalaxyClient } from "./api.ts";
import { ensureCredentials, login } from "./auth.ts";
import { DB_PATH, KNOWN_CATEGORIES, RAW_DIR } from "./config.ts";
import { readStoredCredentials } from "./credentials.ts";
import { openDatabase, reencodeXgids, writeBatch } from "./db.ts";
import { withSyncLock } from "./lock.ts";
import { readRawPages, resolveCategories, scrapeCategory } from "./scrape.ts";
import { syncIncremental } from "./sync.ts";
import { normalize } from "./transform.ts";
import { verifyConverter } from "./verify.ts";

interface Args {
  command: string;
  categories: string[];
  delayMs: number;
  resume: boolean;
  full: boolean;
  includeRecent: boolean;
  maxPages: number;
  dbPath: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[0] ?? "help",
    categories: [],
    delayMs: 1000,
    resume: false,
    full: false,
    includeRecent: false,
    maxPages: 100,
    dbPath: DB_PATH,
  };

  for (const arg of argv.slice(1)) {
    const [key, value] = arg.startsWith("--") ? arg.slice(2).split("=") : [arg, undefined];
    if (key === "category" && value) args.categories.push(...value.split(","));
    else if (key === "delay" && value) args.delayMs = Number(value);
    else if (key === "max-pages" && value) args.maxPages = Number(value);
    else if (key === "db" && value) args.dbPath = value;
    else if (key === "resume") args.resume = true;
    else if (key === "full") args.full = true;
    else if (key === "include-recent") args.includeRecent = true;
  }

  return args;
}

const HELP = `
galaxy-scraper — pull Backgammon Galaxy blunder analysis into SQLite

  sync [options]             Log in if needed, then fetch what's new and load it
  login                      Capture fresh tokens from the Galaxy web client
  categories                 List blunder categories and counts
  scrape [options]           Download category pages into raw/
  load [options]             Build the SQLite database from raw/
  reencode [options]         Rewrite every XGID from the GNU BG ids already stored
  stats [options]            Summarise what is in the database
  verify                     Check the XGID converter against Galaxy's own XGIDs

Options
  --category=a,b             Limit to specific categories (repeatable)
  --delay=1000               Milliseconds between requests
  --full                     Make sync fetch every page, not just what's new
  --resume                   Reuse pages already downloaded
  --include-recent           Include the cross-cutting "recent" category
  --max-pages=100            Safety cap on pages per category
  --db=<path>                Database location

Credentials live in .auth.json beside the database (written by login) and are renewed
automatically while the refresh token lasts. $GALAXY_TOKEN or a .token file still work.
`;

function loadIntoDatabase(dbPath: string, selfId: string | null): void {
  const pages = readRawPages();
  if (pages.length === 0) {
    console.log(`No cached pages in ${RAW_DIR}. Run "scrape" first.`);
    return;
  }

  const db = openDatabase(dbPath);
  const totals = { matches: 0, blunders: 0, candidates: 0, cubes: 0 };

  for (const { category, payload } of pages) {
    const batch = normalize(payload?.data?.events ?? [], category, selfId);
    const written = writeBatch(db, batch);
    totals.matches += written.matches;
    totals.blunders += written.blunders;
    totals.candidates += written.candidates;
    totals.cubes += written.cubes;
  }

  const distinct = db.prepare("SELECT COUNT(*) AS n FROM blunders").get() as { n: number };
  const moves = db.prepare("SELECT COUNT(*) AS n FROM candidate_moves").get() as { n: number };
  const matches = db.prepare("SELECT COUNT(*) AS n FROM matches").get() as { n: number };
  db.close();

  console.log(`\nRead ${pages.length} cached pages (${totals.blunders} blunder rows written).`);
  console.log(`Database: ${dbPath}`);
  console.log(`  ${distinct.n} distinct blunders`);
  console.log(`  ${moves.n} candidate moves`);
  console.log(`  ${matches.n} matches`);
}

function printStats(dbPath: string): void {
  const db = openDatabase(dbPath);
  const rows = db
    .prepare(
      `SELECT source_classification AS category, kind, COUNT(*) AS n,
              ROUND(AVG(error_magnitude), 4) AS avg_error
         FROM blunders
        GROUP BY source_classification, kind
        ORDER BY n DESC`,
    )
    .all() as { category: string; kind: string; n: number; avg_error: number }[];

  console.log("\ncategory                  kind      count  avg error");
  console.log("-".repeat(56));
  for (const r of rows) {
    console.log(
      `${(r.category ?? "?").padEnd(25)} ${(r.kind ?? "?").padEnd(9)} ${String(r.n).padStart(5)}  ${r.avg_error ?? ""}`,
    );
  }

  const worst = db
    .prepare(
      `SELECT ROUND(error_magnitude, 3) AS err, source_classification AS cat,
              die_1, die_2, played_notation AS played, best_notation AS best,
              cube_action, source_xgid
         FROM blunders
        WHERE error_magnitude IS NOT NULL
        ORDER BY error_magnitude DESC LIMIT 10`,
    )
    .all() as Record<string, string | number | null>[];

  console.log("\nWorst 10 positions");
  console.log("-".repeat(56));
  for (const r of worst) {
    const roll = r.die_1 ? `${r.die_1}-${r.die_2}` : (r.cube_action ?? "cube");
    const move = r.played ? `${r.played}  (best: ${r.best})` : String(r.cube_action ?? "");
    console.log(`  -${r.err}  ${String(r.cat).padEnd(18)} ${String(roll).padEnd(17)} ${move}`);
    console.log(`          ${r.source_xgid}`);
  }
  db.close();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "help" || args.command === "--help") {
    console.log(HELP);
    return;
  }

  if (args.command === "stats") {
    printStats(args.dbPath);
    return;
  }

  if (args.command === "verify") {
    const report = verifyConverter();
    if (report.total === 0) {
      console.log('No cached pages to verify against. Run "scrape" first.');
      return;
    }
    const pct = ((report.exact / report.total) * 100).toFixed(2);
    console.log(`XGID converter: ${report.exact}/${report.total} exact (${pct}%)`);
    for (const m of report.mismatchesByField) {
      console.log(
        `  ${m.field.padEnd(9)} ${String(m.count).padStart(5)} wrong  got=${m.got} want=${m.want}`,
      );
    }
    if (report.exact !== report.total) process.exitCode = 1;
    return;
  }

  if (args.command === "reencode") {
    const db = openDatabase(args.dbPath);
    const { checked, rewritten } = reencodeXgids(db);
    db.close();
    console.log(`Re-encoded ${rewritten} of ${checked} positions in ${args.dbPath}.`);
    return;
  }

  if (args.command === "load") {
    // selfId only affects which player is labelled "self"; an expired token still has it.
    const selfId = readStoredCredentials()?.selfId ?? null;
    if (!selfId) console.log("(no token available — falling back to player1 as self)");
    loadIntoDatabase(args.dbPath, selfId);
    return;
  }

  if (args.command === "login") {
    await login();
    return;
  }

  if (!["sync", "all", "scrape", "categories"].includes(args.command)) {
    console.log(HELP);
    return;
  }

  // Renewing the token is a write to the login every checkout shares, so it waits its turn.
  const ran = await withSyncLock(() => fetchFromGalaxy(args));
  if (ran === null) console.log("Another sync is running. Try again in a minute.");
}

async function fetchFromGalaxy(args: Args): Promise<void> {
  const credentials = await ensureCredentials();
  const client = new GalaxyClient(credentials, { delayMs: args.delayMs });

  if (args.command === "sync" && !args.full) {
    const db = openDatabase(args.dbPath);
    try {
      const { newBlunders } = await syncIncremental(client, db, {
        selfId: credentials.selfId,
        onProgress: (m) => console.log(m),
      });
      console.log(newBlunders ? `\n${newBlunders} new blunders.` : "Nothing new on Galaxy.");
    } finally {
      db.close();
    }
    return;
  }

  const discovered = await client.fetchCategories();
  if (discovered) console.log(`Categories endpoint: ${discovered.path}`);
  else console.log("Categories endpoint not found — using the known category list.");

  if (args.command === "categories") {
    const counts = discovered?.counts;
    if (!counts) {
      console.log(KNOWN_CATEGORIES.join("\n"));
      return;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    let total = 0;
    for (const [name, count] of entries) {
      console.log(`  ${name.padEnd(24)} ${String(count).padStart(5)}`);
      total += count;
    }
    console.log(`  ${"TOTAL".padEnd(24)} ${String(total).padStart(5)}`);
    return;
  }

  const scrapeThenLoad = args.command === "sync" || args.command === "all";
  const categories = resolveCategories(discovered?.counts ?? null, args);
  console.log(`\nScraping ${categories.length} categories at ${args.delayMs}ms/request...\n`);

  let grandTotal = 0;
  for (const category of categories) {
    const { pages, blunders } = await scrapeCategory(client, category, {
      resume: args.resume,
      maxPages: args.maxPages,
      onProgress: (m) => console.log(m),
    });
    console.log(`${category}: ${blunders} blunders across ${pages} pages`);
    grandTotal += blunders;
  }
  console.log(`\nScraped ${grandTotal} blunders into ${RAW_DIR}`);

  if (scrapeThenLoad) loadIntoDatabase(args.dbPath, credentials.selfId);
}

main().catch((error: unknown) => {
  console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
