# Galaxy Auto-Sync

## Problem Statement

How might we keep the blunder database current without ever thinking about it, so finishing a match on Galaxy is all it takes for its blunders to show up in the app?

## Recommended Direction

**The web server owns sync.** A single job in the Next server (held on `globalThis`, so HMR doesn't duplicate it) runs from two triggers: dev-server boot plus a ~10 min interval via `instrumentation.ts`, and app mount via a throttled `sync.start` mutation. Each run renews the token, then does **one** request — `recent` page 1. If its top `blunder_id` isn't above the DB's max, it stops silently. Otherwise it scrapes each category from page 1, stopping at the first page containing a known id (or shorter than 100 rows), writes through a dedicated writable connection, and records the run.

**The client only listens.** It polls `sync.status` (fast while scraping, ~30s otherwise so it catches interval-triggered jobs). Once a run gets past the check, a loading toast shows the design system's Progress (categories done / total); on completion `toastManager.update()` turns it into a success toast — "3 new blunders" with a link — and the client invalidates queries and calls `router.refresh()`. Errors get an error toast; an expired login says to run `pnpm blunders`.

**Why:** it removes the chore entirely, incremental paging makes it cheap enough to run constantly, and frequent sync preserves history Galaxy's apparent 300-per-category window discards. Progress and Toast get the polish they need to carry this and future long-running feedback.

## What the code and cache showed

- Category pages are strictly newest-first: blunder ids descend across pages, 100 per page. Stopping at the first known id is safe.
- `blitz` and `middle_game` are both exactly 3×100 followed by an empty page, which suggests a 300-per-category cap. A category-count diff can't detect new blunders in a capped category, so the check compares ids.
- Of the 41 requests a full sync makes today, 17 are the trailing empty page that signals the end.
- `load` is `INSERT OR REPLACE` into a WAL database, so the web app's read-only handle sees new rows as soon as they commit — no restart needed.
- `ensureCredentials()` falls back to an interactive, TTY-only `login()`, so the server needs a non-interactive variant.
- `.auth.json` and `raw/` resolve from `PACKAGE_ROOT`, which is per worktree, while the DB and notes are shared from the main checkout (`scripts/setup-worktree.ts`). Server-side sync would silently fail in a worktree.
- The design system's `Toaster` renders only `description` (no title, type, action, close, or custom content), and `Progress` has no indeterminate state, always renders its value text, takes only a string label, and borrows `--badge-*` variables.

## Key Assumptions to Validate

- [x] Newest-first ordering — verified on the cached raw pages.
- [ ] `recent` page 1 is a reliable "anything new?" signal — after the next match, compare its top id to the max across categories.
- [ ] Galaxy's analysis lag is short — note how long after a match its blunders appear; it sets the interval.
- [ ] CLI and server can both refresh the token — reuse one refresh token twice; if the second fails, serialize access to `.auth.json` and re-read before refreshing.
- [ ] The 300 cap is a rolling window — check whether a capped category's oldest id moves after new blunders land.
- [ ] The interval registers once under `next dev` — log job starts across an edit session.

## MVP Scope

Two PRs, design system first.

**1. design-system (uiid), released first**

- **Progress:** indeterminate state for `value={null}` (reduced-motion-safe animation), ability to hide the value text, `label` accepts a ReactNode, own `--progress-*` variables instead of `--badge-*`, examples and tests.
- **Toaster:** renders `title`, `description`, `type` (loading / success / error), a close button, `actionProps`, and `data.progress` → `<Progress>`; works with `update()` and `timeout: 0` for loading toasts. Examples and tests.

**2. backgammon-app**

- **Scraper:** `syncIncremental()` library function with a phase callback (checking → scraping `{ category, done, total }` → done `{ newBlunders }`); stop at the first known id; treat a short page as the last one. CLI `sync` uses it, `--full` keeps today's behaviour.
- **Auth:** non-interactive `ensureCredentials` for the server; `.auth.json` and `raw/` live beside the shared DB, as `notes.db` does.
- **Web:** sync job module, `instrumentation.ts` trigger, `sync.start` / `sync.status` procedures, a `sync_runs` table for throttling and last-run info, a `SyncToasts` client component in the layout, design-system version bump.

## Not Doing (and Why)

- **UI login or bookmarklet** — renewing on every run makes expiry rare; the error toast points to the CLI.
- **A "Sync now" button** — the goal is to be notified, not to drive it. Adding one later is a single `sync.start` call.
- **SSE / tRPC subscriptions** — polling a local status query is enough for jobs of 1–5 requests.
- **A "new since last sync" review queue** — the success toast links to the new blunders; a dedicated queue is its own idea.
- **Syncing outside the dev server (launchd)** — the interval covers the hours the app is running.
- **Per-page progress** — categories are the unit; a category is almost always a single page.
- **Toast when nothing is new** — the common case should be silent.

## Open Questions

- Where does "3 new blunders" link? There's no "recent" view yet.
- Should the ~10 min interval be configurable through an env variable?
- Should the CLI and the server share a lockfile so a manual `pnpm blunders` during an auto-sync doesn't run twice?
- Does bumping the design system from 0.6.3 to the new release (including 0.6.5's cva change) need any migration here?
