# Implementation Plan: Part 6 — Mutations (notes on a blunder)

Linear: [BG-16](https://linear.app/uiid/issue/BG-16/begin-spec-for-phase-6-mutations) · branch `bg-16` · base `main` @ `3f0a6d4`

## Overview

Part 6 is the app's first write. The feature is the one `LEARNING.md:2196` already named: a scratchpad textarea for notes on a blunder. The mutation itself is small. Most of this plan is the storage decision, because that is the part that is expensive to undo — the ticket asks that it survive a move to IndexedDB, to Supabase, or staying on SQLite.

Delivery follows the house pattern. Claude builds and ships the server side (store, context, procedures), and the Part opens with an "Already done for you" preface. The client side is built in a scratch worktree only to verify the doc's snippets, preserved on a local reference branch, reverted, and typed by Adam from `LEARNING.md`.

## The storage decision

### Recommendation: a separate store, not just a separate table

The instinct in the ticket — don't pollute the scraped data — is right, and it goes one step further than a new table: notes belong in **their own database file**, not inside `blunders.db`. Three reasons, each verified this session in scratch SQLite (`node:sqlite`, SQLite 3.50.4):

1. **`blunders.db` is a disposable artifact.** Everything in it is regenerated from `raw/` by `load`, and BG-7's settled direction replaces the file wholesale — drag a fresh `blunders.db` into the app. Anything written inside it dies at the next import. Notes are the only data in the system that cannot be regenerated, so they cannot share a lifecycle with data that can.
2. **The textbook schema deletes notes on every load.** The scraper writes with `INSERT OR REPLACE` under `PRAGMA foreign_keys = ON` (`packages/galaxy-scraper/src/db.ts:126,145`). REPLACE is a delete followed by an insert, so `notes.blunder_id REFERENCES blunders(blunder_id) ON DELETE CASCADE` — the schema anyone would reach for — emptied the notes table the moment its blunder was re-loaded. Without `CASCADE` the note survived. A same-file design is only safe as long as nobody ever adds the obvious constraint.
3. **`blunders.db` stays read-only.** `apps/web/server/db.ts` opens it `{ readOnly: true }`, which guarantees no request can damage scraped data. `ATTACH`ing a writable file does not get around that: the attach succeeded, and the first write to it threw `attempt to write a readonly database`. A writable table means giving up that guarantee or opening a second connection — and a second connection is a separate store already.

**What it costs:** no SQL `JOIN` between notes and blunders. Anything combining them — a "has a note" marker in the list — joins in JavaScript on `blunder_id`. That is not a loss of flexibility; it is the only join that works across every backend on the table. IndexedDB cannot join at all, and a Supabase notes table cannot join a local blunders file.

### Shape of the data

- **One table:** `notes (blunder_id INTEGER PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL)`. One row per blunder, keyed by id, so every candidate backend holds it natively: a SQLite or Postgres table, an IndexedDB object store with `keyPath: "blunder_id"`, or a JSON file.
- **Keyed on `blunder_id`,** which is Galaxy's own event id (`transform.ts:181`), not a number the scraper invents — stable across re-scrapes and re-imports. **No foreign key**, deliberately (reason 2). A note whose blunder disappears is an orphan that is never shown.
- **`updated_at`** is ISO 8601 text written by the store. Part 6's UI never reads it, but it is the one column a later sync (last write wins between devices) needs, and it cannot be backfilled.
- **Clearing a note deletes the row** rather than storing `""`, so "has a note" means "row exists" in every backend.
- **Save is an upsert:** `INSERT … ON CONFLICT (blunder_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at` — verified in SQLite, and valid Postgres as written (only the placeholders differ, `?` vs `$1`). IndexedDB's `put()` is an upsert natively.
- **Future user data** (reviewed flags, spaced repetition) gets its own table in the same store when it arrives. No generic "annotations" table in advance.

### The seam that keeps it flexible

Two boundaries already exist; notes add one thin third.

1. **tRPC** — the browser never knows what the store is. Already true.
2. **`ctx`** — procedures reach storage only through `createContext()`. Already true for `db`.
3. **New: a `NotesStore` interface** — `get`, `save`, `remove`, `ids` — with one SQLite implementation in `server/notes.ts`, opened in `server/db.ts` and injected as `ctx.notes`. The router never contains notes SQL, and rules that don't vary by backend (a blank body means delete) live in the router rather than in every store. Moving to Supabase or IndexedDB is one new file implementing four functions and one changed line in `db.ts`.

Two details make that seam real rather than decorative:

- **The interface returns Promises even though `node:sqlite` is synchronous.** Supabase and IndexedDB are async-only. A synchronous interface would make the swap touch every call site; an async one makes it touch none, and `async` on a synchronous implementation costs nothing.
- **The file opens lazily, on first use,** not at module load. `/` is prerendered at build time and imports the context, so the build should neither create nor require a notes file.

**Why not use `ctx.db.prepare()` as the portable layer, the way BG-7 plans to for blunders:** that bet is "SQL everywhere" via sqlite-wasm, which suits query-heavy blunder data with CTEs and joins. Notes are a key-value lookup. Tying them to SQL would rule out the raw-IndexedDB and plain Supabase-client options the ticket wants kept open, and buy nothing.

### Deliberately not doing

- **No ORM or query builder** (Drizzle, Kysely). One table and three statements do not pay for a dependency.
- **No migration tool.** `CREATE TABLE IF NOT EXISTS` on open; `PRAGMA user_version` is the hook for when a second schema change arrives.
- **No auth or RLS.** Single user, local — the same line BG-2 drew.
- **No Server Actions for the write.** Under BG-7's direction the router may run in the browser against a local store, and a Server Action needs a server; a tRPC mutation works in both worlds. Server Actions still appear in the doc as the comparison.

## What Part 6 teaches (client side, Adam's)

- `useMutation(trpc.notes.save.mutationOptions())` — `mutate`, `isPending`, `isError`; unlike a query, a mutation is not cached and does not run on mount.
- After a write the cache is wrong: `setQueryData` with the returned row versus `invalidateQueries` and a refetch.
- The note is prefetched on the blunder page and hydrated (Part 2.5's pattern), so the textarea's first paint already has the saved text. `BlunderAnalysis` stays a Server Component; the editor is a client island beside it.
- Optimistic UI, modern and older: render the mutation's `variables` while pending (v5), versus an `onMutate` snapshot, `setQueryData`, and rollback in `onError`. House rule: implement the modern one, explain both.
- Autosave: debounce, then `scope: { id }` so saves for one blunder run one at a time (present in the installed query-core 5.102.8). Without it, a slow earlier save can land after a later one and overwrite it.
- Invalidating something else: the list's "has a note" marker reads `notes.ids`, and saving invalidates it — a write in one component correcting a read in another.
- The same save written as a Server Action with `useActionState`, and why this app does not use one.

## Dependency graph

```
server/notes.ts   NotesStore interface + SQLite impl (lazy open, WAL, schema)
      │
      └──> server/trpc.ts   ctx.notes
                 │
                 └──> server/router.ts   notes.byBlunder · notes.save · notes.ids
                           │                              │
                           v                              v
        [blunderId]/page.tsx prefetch          layout.tsx prefetches notes.ids
        note-editor.tsx (client)               blunder-list.tsx builds a Set
        useMutation, save, cache update        blunder-list-links.tsx marker
        (Task 3)                               (Task 5)
                 │                                        ^
                 v                                        │
        optimistic autosave, scope (Task 4) ── save invalidates notes.ids
                                  │
                                  v
                    LEARNING.md Part 6 (Tasks 7-8)
```

---

## Phase 1 — Slice: save one note and read it back

### Task 1: The notes store behind an interface

**Description:** Add `server/notes.ts` exporting a `NotesStore` type and a SQLite implementation that opens its file lazily, enables WAL, creates the table if missing, and implements `get`, `save`, `remove` and `ids` as async functions. `server/db.ts` resolves its path beside the open `blunders.db` and caches it on `globalThis` like `db`; `createContext()` exposes it as `notes`. The blunders connection is untouched.

**Acceptance criteria:**

- [ ] `save` upserts and stamps `updated_at`; `remove` deletes the row; `ids()` returns every `blunder_id` with a note. What counts as a blank body is the router's rule (Task 2), not each store's.
- [ ] Opening is lazy — `pnpm build` passes and creates no notes file.
- [ ] `server/db.ts` still opens `blunders.db` with `{ readOnly: true }`, and nothing references blunders from the notes schema.

**Verification:**

- [ ] Types: `pnpm check-types` · Lint: `pnpm lint` · Build: `pnpm build`
- [ ] Manual: a node script against a `/tmp` store exercises save, overwrite, clear and `ids()`.
- [ ] Manual: with a note saved, run `pnpm --filter @repo/galaxy-scraper load --db=<scratch copy>` from the main checkout (`raw/` lives only there) — the note is still there.

**Dependencies:** None (Open Question 1 resolved)
**Files likely touched:** `apps/web/server/notes.ts` (new), `apps/web/server/db.ts`, `apps/web/server/trpc.ts`, `scripts/setup-worktree.ts` (its comment and generated `.env.local` text say the shared database is safe because it is read-only — no longer the whole story)
**Estimated scope:** Small

### Task 2: Read and write procedures

**Description:** Add a `notes` router: `byBlunder` (query, `{ blunder_id }` → note or null), `save` (mutation, `{ blunder_id, body }` → saved note or null), `ids` (query → `number[]`). A blank or whitespace-only body calls `ctx.notes.remove` and returns null. Every procedure gets `.output()`, like the existing ones, and calls only `ctx.notes` — plus one read-only existence check against `ctx.db` in `save`.

**Acceptance criteria:**

- [ ] `router.ts` contains no notes SQL; all notes storage goes through `ctx.notes`.
- [ ] A body over the maximum length (Open Question 5) is rejected by Zod before the store is called.
- [ ] Saving against a `blunder_id` that is not in `blunders` fails with `NOT_FOUND` rather than writing an orphan.

**Verification:**

- [ ] Types, lint, build as above.
- [ ] Manual: dev server on a port other than 3000 with `NOTES_DB_PATH=/tmp/…`; `curl` a POST to `/api/trpc/notes.save`, then GET `notes.byBlunder` and `notes.ids`.
- [ ] Manual, the flexibility proof: swap `ctx.notes` for a throwaway `Map`-backed store in `trpc.ts`. The router compiles unchanged and the `curl` round trip still passes. Revert.

**Dependencies:** Task 1
**Files likely touched:** `apps/web/server/router.ts`
**Estimated scope:** Small

### Task 3: A textarea that saves (reference implementation)

**Description:** A client `NoteEditor` rendered on the blunder page beside `BlunderAnalysis`. The page prefetches `notes.byBlunder` and wraps the editor in a `HydrationBoundary`; the editor reads with `useQuery`, saves with `useMutation` (interaction per Open Question 2), shows pending and error states, and writes the returned note into the cache with `setQueryData`.

**Acceptance criteria:**

- [ ] A saved note is present after a hard reload, on first paint — no flash of an empty textarea.
- [ ] Moving between blunders shows each one's own note; the textarea resets per blunder (`key={blunder_id}`, Part 2's lesson).
- [ ] A failed save keeps the typed text in the textarea and says it did not save.

**Verification:**

- [ ] Types, lint, build as above.
- [ ] Manual: network tab shows one POST per save and no refetch of `byBlunder` afterwards.

**Dependencies:** Task 2
**Files likely touched:** `apps/web/app/[category]/[blunderId]/page.tsx`, `apps/web/app/[category]/note-editor.tsx` (new)
**Estimated scope:** Small

### Checkpoint: Phase 1

- [ ] `pnpm check-types`, `pnpm lint`, `pnpm build` pass
- [ ] A note survives reload, navigation, and a scraper `load`
- [ ] `blunders.db` is still opened read-only; `router.ts` has no notes SQL
- [ ] Review with Adam — in particular that the save interaction is right before autosave builds on it

---

## Phase 2 — Slice: the mutation grows up

### Task 4: Optimistic autosave

**Description:** Save on a debounce while typing and immediately on blur. Serialize saves per blunder with `scope: { id }`. Show the optimistic state from the mutation's `variables`; build the `onMutate` + rollback variant alongside it in the scratch worktree so the doc's comparison is verified code too.

**Acceptance criteria:**

- [ ] With the network throttled, typing quickly and stopping always ends with the last text stored, never an earlier one.
- [ ] Leaving the blunder mid-debounce still saves (flush on blur and unmount).
- [ ] "Saving… / Saved" comes from mutation state, not a separate `useState`; the `onMutate` variant rolls back on error.

**Verification:**

- [ ] Types, lint, build as above.
- [ ] Manual: throttled network tab shows the POSTs for one blunder strictly one after another.

**Dependencies:** Task 3
**Files likely touched:** `apps/web/app/[category]/note-editor.tsx`
**Estimated scope:** Small

### Task 5: The list knows which blunders have notes

**Description:** The layout prefetches `notes.ids` next to `byCategory`; `blunder-list.tsx` turns it into a `Set` and passes a flag down to `BlunderListLinks`, which renders a marker. The editor's successful save invalidates `notes.ids`. `byCategory` does not change.

**Acceptance criteria:**

- [ ] The marker shows for every blunder with a note, including on a cold load, with no pop-in.
- [ ] Saving a first note, or clearing one, updates the marker without a reload.
- [ ] `byCategory`'s input, output and query key are untouched — the join is in JavaScript.

**Verification:**

- [ ] Types, lint, build as above.
- [ ] Manual: `git diff main -- apps/web/server/router.ts` shows no change inside `byCategory`.

**Dependencies:** Task 2; Task 4 for the final invalidation site
**Files likely touched:** `apps/web/app/[category]/layout.tsx`, `apps/web/app/[category]/blunder-list.tsx`, `apps/web/app/[category]/subcomponents/blunder-list-links.tsx`, `apps/web/app/[category]/note-editor.tsx`
**Estimated scope:** Medium

### Checkpoint: Phase 2

- [ ] All three checks pass and the app runs
- [ ] Throttled autosave never loses or reorders an edit
- [ ] Marker and editor agree after every save and clear
- [ ] Review with Adam before writing the doc

---

## Phase 3 — Write it down

### Task 6: Preserve the reference implementation, revert the client

**Description:** Commit the full client implementation to a local `bg-16-reference-impl` branch (not pushed), then revert the client files on `bg-16` so only the server changes remain — the BG-14 pattern.

**Acceptance criteria:**

- [ ] `git diff bg-16-reference-impl -- apps/web/app` shows exactly the client work.
- [ ] On `bg-16`, `apps/web/app/` is identical to `main`, and the app still builds with the server changes alone.

**Verification:**

- [ ] `pnpm build` passes on `bg-16` after the revert.

**Dependencies:** Checkpoint: Phase 2
**Files likely touched:** none new
**Estimated scope:** XS

### Task 7: Write Part 6 into LEARNING.md

**Description:** Open with the "Already done for you" preface — the store, `ctx.notes`, the three procedures and their shapes — plus one plain paragraph on why notes live in their own file, since the client relies on its consequence: there is no join, so the list marker is joined in JavaScript. Then the client sections in the house shape (whole file, the pieces, gotchas), split per Open Question 3.

**Acceptance criteria:**

- [ ] Snippets are extracted from `LEARNING.md` itself and built in a scratch worktree with `NOTES_DB_PATH` pointed at `/tmp`; each sub-part compiles standing alone.
- [ ] Both comparisons are present: `variables` versus `onMutate` for optimistic UI, and `useMutation` versus a Server Action.
- [ ] Gotchas cover at least: the cache is stale after a write; out-of-order autosaves and `scope`; `key` resetting the textarea per blunder; a debounce losing the last edit on navigation.

**Verification:**

- [ ] Manual: typeable start to finish in order — nothing used before it is defined.
- [ ] `pnpm format:check` passes; no code fence inside a blockquote; no hard-wrapped prose.

**Dependencies:** Task 6
**Files likely touched:** `LEARNING.md`
**Estimated scope:** Small (one file, substantial prose)

### Task 8: Reconcile the surrounding threads

**Description:** Fix everything elsewhere in the doc that Part 6 changes or contradicts.

**Acceptance criteria:**

- [ ] `LEARNING.md:3514` and `:3518` promise that Part 6 revisits the severity bands and grouping. Part 6 does not, so those lines are reworded to stop pointing there.
- [ ] Every "Then **Part 6**, mutations." hand-off (`:2489`, `:2947`, `:3340`, `:3528`) and the scope sentence at `:2196` match what Part 6 became.
- [ ] Contents lists Parts 5.6, 5.7 and 6 (it currently stops at 5.5), and the intro's worktree paragraph mentions the notes file.

**Verification:**

- [ ] `grep -n "Part 6" LEARNING.md` — every hit is accurate.
- [ ] `pnpm format:check` passes.

**Dependencies:** Task 7
**Files likely touched:** `LEARNING.md`
**Estimated scope:** XS

### Checkpoint: Doc complete

- [ ] Part 6 reads in the same voice as Part 5.x
- [ ] Every snippet was built from the doc's own text
- [ ] Review with Adam

---

## Phase 4 — Land it

### Task 9: Commit, PR, Linear

**Description:** Commit the server changes, the doc and these task files; push; open the PR; post the storage decision to BG-16 and move it.

**Acceptance criteria:**

- [ ] The PR contains `server/notes.ts`, `server/trpc.ts`, `server/router.ts`, `scripts/setup-worktree.ts`, `LEARNING.md` and `tasks/*` — no files under `apps/web/app/`.
- [ ] The PR body summarizes the storage decision and says the client is typed separately.
- [ ] BG-16 has the decision as a comment, links BG-7 (a file-drop import can no longer touch notes, by construction), and is moved.

**Verification:**

- [ ] All checks green on the pushed branch.

**Dependencies:** All previous
**Estimated scope:** XS

---

## Risks and Mitigations

| Risk                                                                                     | Impact                                     | Mitigation                                                                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Verification worktrees write test notes into the real notes file                         | Medium — pollutes Adam's own data          | Every scratch run sets `NOTES_DB_PATH` to `/tmp`; Tasks 2 and 7 name it explicitly                                 |
| Two dev servers (main checkout and a worktree) writing one notes file                    | Low                                        | SQLite handles multi-process writers; WAL on the notes connection, as the scraper does                             |
| Debounced autosave drops the last edit on navigation                                     | Medium — silent loss in a notes feature    | Flush on blur and unmount; Task 4 tests it                                                                         |
| Out-of-order saves overwrite newer text                                                  | Medium                                     | `scope` serializes per blunder; throttled test in Task 4                                                           |
| Someone later "fixes" the missing foreign key with `ON DELETE CASCADE`                   | High if notes ever share the blunders file | A comment in `notes.ts` citing the verified behavior; the separate file makes the constraint impossible regardless |
| `blunder_id` collides if the app imports from a second source (BG-7's naming discussion) | Low today                                  | Out of scope; a `(source, blunder_id)` key is the fix, and the one-row-per-blunder shape makes it additive         |
| The doc drifts back into server detail Adam asked to skip                                | Medium                                     | Preface plus one paragraph; the full rationale lives here and in the PR                                            |

## Open Questions

1. ~~**Where does the notes file live?**~~ **Resolved:** `NOTES_DB_PATH ?? join(dirname(<open blunders.db>), "notes.db")`. Every worktree already points `BLUNDERS_DB_PATH` at the main checkout, so all checkouts share one notes file there with no setup change, deleting a worktree never deletes notes, and `data/` and `*.db` are already gitignored.
2. ~~**Save interaction in the first slice.**~~ **Resolved:** save on blur plus a button in Task 3, autosave in Task 4 — two lessons rather than one tangled one.
3. ~~**Doc numbering.**~~ **Resolved:** Part 6 (`useMutation` and the cache after a write), Part 6.5 (optimistic autosave), Part 6.6 (invalidating the list).
4. ~~**Is the list marker in scope?**~~ **Resolved:** yes.
5. ~~**Maximum note length.**~~ **Resolved:** 2,000 characters, as `NOTE_MAX_LENGTH` in `lib/constants.ts` so Zod and the textarea's `maxLength` share one number.
