/**
 * Points a checkout without its own scraped database at the one in the main
 * checkout, by writing `apps/web/.env.local`.
 *
 * `packages/galaxy-scraper/data/` is gitignored, so the database exists in
 * exactly one place. A fresh worktree resolves `DB_PATH` to a file that isn't
 * there, and every page throws inside `node:sqlite` — which reads like broken
 * application code rather than a missing database.
 *
 * The notes file sits beside whichever database is open (`apps/web/server/db.ts`),
 * so this also points the checkout at the main checkout's notes. That is on
 * purpose: a worktree is deleted when its branch merges, and its notes would go
 * with it.
 *
 * Runs on `postinstall`, or by hand with `pnpm setup:worktree`. It only ever
 * creates the file: an existing `.env.local` is left untouched, since it may be
 * pointing at a scratch copy on purpose.
 */

import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = join(REPO_ROOT, "apps", "web", ".env.local");
const DB_SUBPATH = join("packages", "galaxy-scraper", "data", "blunders.db");

const log = (message: string): void => console.log(`setup:worktree — ${message}`);

/**
 * The main checkout, or `null` if git can't say.
 *
 * Every worktree shares one `--git-common-dir`, so this resolves to the same
 * directory from all of them — and in the main checkout it is simply its own
 * `.git`, which is why there is no "am I a worktree" branch here.
 * `--path-format` needs git 2.31 or newer.
 */
function findMainCheckout(): string | null {
  try {
    const commonDir = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return commonDir === "" ? null : dirname(commonDir);
  } catch {
    return null;
  }
}

function main(): void {
  // Never clobber a file someone may have pointed at a scratch database.
  if (existsSync(ENV_FILE)) return;

  // The main checkout, and any worktree that has run the scraper, lands here.
  if (existsSync(join(REPO_ROOT, DB_SUBPATH))) return;

  const mainCheckout = findMainCheckout();
  if (mainCheckout === null) {
    log("could not ask git for the main checkout, so no database path was written.");
    return;
  }

  const dbPath = join(mainCheckout, DB_SUBPATH);
  if (!existsSync(dbPath)) {
    log(`no scraped database in this checkout or in ${mainCheckout}.`);
    log("run `pnpm --filter @repo/galaxy-scraper all` to scrape one; nothing was written.");
    return;
  }

  writeFileSync(
    ENV_FILE,
    [
      "# Written by `pnpm setup:worktree`: this checkout has no scraped database of",
      "# its own, because packages/galaxy-scraper/data/ is gitignored and the database",
      "# lives only in the main checkout. It is opened read-only, so sharing it across",
      "# checkouts is safe. notes.db beside it is writable and shared on purpose, so",
      "# notes outlive this worktree. Delete this file once you have scraped a database",
      "# here — and notes will then be written beside that one instead.",
      `BLUNDERS_DB_PATH="${dbPath}"`,
      "",
    ].join("\n"),
  );
  log(`wrote apps/web/.env.local pointing BLUNDERS_DB_PATH at ${dbPath}`);
}

main();
