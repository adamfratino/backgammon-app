# TODO: Parts 5.6 (sort) and 5.7 (counts from the database)

BG-14 · branch `bg-14` · full detail in [tasks/plan.md](plan.md)

**Deliverable: `LEARNING.md` Parts 5.6 and 5.7 only.** Tasks 1-5 are built in this worktree purely to verify the snippets, then reverted in Task 9. Adam types the implementation himself.

Before anything that reads the database, this worktree needs `BLUNDERS_DB_PATH` pointed at the main checkout's `packages/galaxy-scraper/data/blunders.db` — there is no `.env.local` here. BG-13 / PR #14 fixes this for good.

## Phase 1 — Part 5.6, sort

- [x] **Task 1 — Sort the query from a whitelist, with a total order.** `SORTS` record in constants, `sort` input on `byCategory`, `ORDER BY` chosen by key, tie-breaker on `d.blunder_id, d.kind`. _(S · `lib/constants.ts`, `server/router.ts` · deps: none)_
- [x] **Task 2 — Read the sort off the URL, on both sides.** `sortFrom` beside `pageFrom`; layout prefetch and list query build the same key. _(S · `lib/constants.ts`, `layout.tsx`, `blunder-list.tsx` · deps: 1)_
- [x] **Task 3 — A control that writes the sort, and every link that carries it.** Panel control, page reset on change, pager + row links + hover prefetch all carry it. _(M · `blunder-filters.tsx`, `blunder-list-pagination.tsx`, `blunder-list.tsx` · deps: 2)_

### Checkpoint: Part 5.6 works

- [x] `pnpm check-types`, `pnpm lint`, `pnpm build` pass
- [x] Sort survives paging, filtering and opening a row
- [ ] No row repeats or disappears across a page boundary (check the `blitz` ties at sorted rows 300/301)
- [ ] Reviewed with Adam

## Phase 2 — Part 5.7, counts from the database

- [x] **Task 4 — Count the buckets in the query.** `GROUP BY` per `(kind, direction, severity)` over the filtered set, severity `CASE` generated from `SEVERITY_BANDS`, counts added to the output. _(M · `server/router.ts`, `lib/constants.ts` · deps: none)_
- [x] **Task 5 — Headings that say "n of N".** Counts threaded into the kind, direction and severity headings, keyed by full path. _(M · `blunder-list.tsx`, `blunder-list-group.tsx` · deps: 4)_

### Checkpoint: Part 5.7 works

- [x] All three checks pass and the app runs
- [ ] Counts agree with `sqlite3` for two categories, filtered and unfiltered — unfiltered `middle_game` is checker 131/65/44/5, cube offer 32/9/8/1, receive 3/3/3
- [x] No heading count is page-local any more
- [ ] Reviewed with Adam

## Phase 3 — Write it down

- [x] **Task 6 — Write Part 5.6 into LEARNING.md.** House shape; snippets copied from the verified worktree; corrected tie figures. _(S · `LEARNING.md` · deps: Checkpoint 1)_
- [x] **Task 7 — Write Part 5.7 into LEARNING.md.** Same shape; real `middle_game` numbers. _(S · `LEARNING.md` · deps: Checkpoint 2, Task 6)_
- [x] **Task 8 — Reconcile the surrounding threads.** Part 5's "Still open" drops 5.6/5.7, Part 4.6 points at 5.7, new sections hand off to 5.8, the bad "59" claim is gone. _(XS · `LEARNING.md` · deps: 6, 7)_

### Checkpoint: Doc complete

- [x] Both parts read in the same voice as 5 and 5.5
- [x] Every number traced to a query run against the real database
- [ ] Typeable start to finish in order — no prop arriving before the component that takes it
- [x] `pnpm format:check` passes
- [ ] Reviewed with Adam

## Phase 4 — Land it

**Verified implementation preserved on local branch `bg-14-reference-impl` (`87eb716`)** — not pushed. Diff your typing against it with `git diff bg-14-reference-impl -- apps/`.

- [x] Reverted — `apps/` and `packages/` are byte-identical to main; `LEARNING.md` is the only tracked change.
- [ ] **Task 9 — Commit the doc, push, open the PR, move BG-14.** _(XS · deps: all)_

## Open questions blocking nothing yet

- [x] ~~Does BG-14 want the code, the doc, or both?~~ **Adam wires it up; this session writes the doc.** Code is built here only to verify snippets, then reverted.
- [x] ~~Does `sort` ride in an extended `filterParams`?~~ **Renamed to `viewParams(filters, sort)`**, sort required so the compiler finds every link.
- [x] ~~Does `total` collapse into the counts `GROUP BY`?~~ **No** — kept separate; documented as deliberate redundancy in 5.7's gotchas.
- [x] ~~Is the default sort written into the URL?~~ **Left implicit** — `viewParams` omits `?sort=worst`.
- [x] ~~Buckets with a total but no rows on this page?~~ **Stay hidden** — unchanged behaviour, documented as a gotcha with the fix spelled out.
