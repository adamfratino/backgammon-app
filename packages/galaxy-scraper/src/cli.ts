#!/usr/bin/env node
import { GalaxyClient } from "./api.ts";
import { DB_PATH, KNOWN_CATEGORIES, loadCredentials, RAW_DIR } from "./config.ts";
import { openDatabase, writeBatch } from "./db.ts";
import { readRawPages, resolveCategories, scrapeCategory } from "./scrape.ts";
import { normalize } from "./transform.ts";
import { verifyConverter } from "./verify.ts";

interface Args {
  command: string;
  categories: string[];
  delayMs: number;
  resume: boolean;
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
    else if (key === "include-recent") args.includeRecent = true;
  }

  return args;
}

const HELP = `
galaxy-scraper — pull Backgammon Galaxy blunder analysis into SQLite

  categories                 List blunder categories and counts
  scrape [options]           Download category pages into raw/
  load [options]             Build the SQLite database from raw/
  all [options]              scrape, then load
  stats [options]            Summarise what is in the database
  verify                     Check the XGID converter against Galaxy's own XGIDs

Options
  --category=a,b             Limit to specific categories (repeatable)
  --delay=1000               Milliseconds between requests
  --resume                   Reuse pages already downloaded
  --include-recent           Include the cross-cutting "recent" category
  --max-pages=100            Safety cap on pages per category
  --db=<path>                Database location

The bearer token is read from $GALAXY_TOKEN or a .token file in the package root.
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
      console.log("No cached pages to verify against. Run \"scrape\" first.");
      return;
    }
    const pct = ((report.exact / report.total) * 100).toFixed(2);
    console.log(`XGID converter: ${report.exact}/${report.total} exact (${pct}%)`);
    for (const m of report.mismatchesByField) {
      console.log(`  ${m.field.padEnd(9)} ${String(m.count).padStart(5)} wrong  got=${m.got} want=${m.want}`);
    }
    if (report.exact !== report.total) process.exitCode = 1;
    return;
  }

  if (args.command === "load") {
    // selfId only affects which player is labelled "self"; the token is optional here.
    let selfId: string | null = null;
    try {
      selfId = loadCredentials().selfId;
    } catch {
      console.log("(no token available — falling back to player1 as self)");
    }
    loadIntoDatabase(args.dbPath, selfId);
    return;
  }

  const credentials = loadCredentials();
  const client = new GalaxyClient(credentials, { delayMs: args.delayMs });

  if (credentials.expiresAt) {
    const days = (credentials.expiresAt.getTime() - Date.now()) / 86_400_000;
    console.log(`Token valid for ${days.toFixed(1)} more days (user ${credentials.selfId ?? "?"}).`);
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

  if (args.command !== "scrape" && args.command !== "all") {
    console.log(HELP);
    return;
  }

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

  if (args.command === "all") loadIntoDatabase(args.dbPath, credentials.selfId);
}

main().catch((error: unknown) => {
  console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
