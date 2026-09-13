# Implementation Plan: Parts 5.6 (sort) and 5.7 (counts from the database)

Linear: [BG-14](https://linear.app/uiid/issue/BG-14/wire-up-part-56-and-57-from-learningmd) · branch `bg-14` · base `main` @ `6541712`

## Overview

Parts 5.6 and 5.7 do not exist in `LEARNING.md` yet. They exist only as two paragraphs in the "Still open" section at the end of Part 5 (`LEARNING.md:2939-2941`), which is the entire spec — the Linear ticket body is empty. **Scope, decided:** Adam wires up the code himself. This session's deliverable is the two doc sections and nothing else. Both features still get built end to end here — but only to prove every snippet works against the real database and a running app — and the app changes are reverted before the PR, which carries `LEARNING.md` alone. This is the BG-12 pattern.

Part 5.6 adds `?sort=worst|mildest`. The lesson is that a SQL keyword cannot be a bound parameter, so `ORDER BY` has to be picked from a whitelist rather than interpolated — the one place in this codebase where a value from the URL chooses SQL text instead of being bound as a value. Underneath it sits a subtler bug: `ORDER BY d.error_magnitude DESC` alone is not a total order, and rows tied on magnitude can repeat or vanish across a page boundary.

Part 5.7 replaces every heading count in the list. Today `Checker plays (37)` means 37 of _this page_, because the count is `.length` on whatever loaded (`blunder-list.tsx:53`, `blunder-list-group.tsx:40`). It should read `Checker plays (37 of 245)`, with the second number coming from a `GROUP BY` over the whole filtered set. This is the thread Part 4.6 left hanging (`LEARNING.md:2194`) and it is called out there by name.

## What the codebase already gives us

Part 5 and Part 5.5 landed together in PR #13, so the pattern both new parts must follow is already in the files:

- `lib/constants.ts` owns every whitelist (`KINDS`, `SEVERITY_BANDS`, `CUBE_DIRECTIONS`) plus the URL reader `filtersFrom` and its inverse `filterParams`. Both new parts extend this file first.
- `server/router.ts` builds `WHERE` conditions as text while binding every value (`router.ts:183-219`). Sort follows the same discipline, except the text is chosen by key rather than assembled.
- `WITH_DECISIONS` (`router.ts:140-149`) is the base every counting or listing query starts from, and it splits a `kind = 'both'` blunder into one checker decision and one cube decision.
- `layout.tsx:24-26` prefetches with a key the browser must reproduce exactly in `blunder-list.tsx:30`. Any new query input has to be added to both or the prefetch is wasted — Part 5.5 already flagged this as "the prefetch key and the query key are two places, forever".

## Verified against the real database

Everything below was run read-only against `packages/galaxy-scraper/data/blunders.db` in the main checkout, and it corrects the "Still open" sketch in two places:

- **The "59 magnitudes are tied" claim in `LEARNING.md:2939` is wrong.** 59 is the number of cube decisions in `middle_game`, not a tie count. The real figures: 60 `(category, magnitude)` groups contain a tie, covering 138 decisions; 56 distinct magnitudes tie somewhere. The largest is a 16-way tie at `0.1016` in `middle_game`, occupying sorted rows 212-227.
- **Only 2 tie groups actually straddle a 50-row page boundary today**, both 2-row ties. The bug is real but currently rare — worth stating honestly rather than implying it is everywhere, because the point is that it is invisible until it isn't.
- `middle_game` has 245 checker decisions and 59 cube decisions, so the doc's `Checker plays (37 of 245)` example is drawn from a real category. Page 1 sorted worst-first actually holds 39 checker rows and 11 cube rows, not 37 — recompute before writing it down.
- The full bucket breakdown for `middle_game` is: checker moderate 131, mild 65, severe 44, catastrophic 5; cube/offer moderate 32, mild 9, severe 8, catastrophic 1; cube/receive severe 3, moderate 3, catastrophic 3. Useful as the expected output when checking Task 4.

## Architecture decisions

- **Sort is a single-valued param, unlike every filter.** `filtersFrom` returns arrays because a filter is a set; sort is one choice out of a whitelist with a default. It gets its own reader (`sortFrom`) rather than being folded into `BlunderFilters`, so the "no sort chosen" case stays a default rather than an empty array.
- **`ORDER BY` text comes from a keyed record, never from string assembly.** `SORTS = { worst: "...DESC", mildest: "...ASC" }`. The input is `z.enum` over its keys, so an unknown sort is rejected by Zod before it can reach SQL, and the only strings that can ever land in the query are ones written in this repo.
- **The tie-breaker is `d.blunder_id, d.kind`, and it is not optional.** `(blunder_id, kind)` is unique in the `decisions` CTE — each branch of the `UNION ALL` emits at most one row per blunder — so appending it makes the order total. Without it SQLite's order among equal magnitudes is unspecified and a paged read can repeat or skip a row.
- **The severity `CASE` expression is built from `SEVERITY_BANDS`, not hand-written.** Part 5 already derives its `WHERE` bands from that constant; 5.7 deriving its `GROUP BY` bands from the same place keeps one source of truth, and the symmetry between the two is itself the teachable moment.
- **Counts respect the active filters.** `(37 of 245)` means 37 on this page, 245 matching the current filters across the whole category — not the unfiltered category total. A count that ignored the filters would contradict the list it labels.
- **Doc sections are written from code that was run**, per the house rule that has already caught wrong claims in this doc. Every snippet in Parts 5.6 and 5.7 must come out of a worktree where `check-types`, `lint` and `build` passed and the page was actually loaded.

## Dependency graph

```
lib/constants.ts
  SORTS + DEFAULT_SORT + sortFrom        severityCase() (SQL CASE from SEVERITY_BANDS)
        │                                        │
        ├──> server/router.ts ORDER BY ──┐       └──> server/router.ts counts GROUP BY
        │    (Task 1)                    │            (Task 4)
        │                                │                   │
        ├──> layout.tsx prefetch key ────┤                   │
        │    blunder-list.tsx query key  │                   │
        │    (Task 2)                    │                   │
        │                                │                   v
        └──> blunder-filters.tsx (writes ?sort=)      blunder-list.tsx headings
             pagination + row links (carry it)        blunder-list-group.tsx headings
             (Task 3)                                 (Task 5)
                     │                                        │
                     └────────────> LEARNING.md <─────────────┘
                                    Part 5.6 (Tasks 6)  Part 5.7 (Task 7)
                                    surrounding threads (Task 8)
```

Part 5.6 and Part 5.7 touch the same three files but never the same lines, and 5.7's counts do not depend on sort. They could be built in parallel; they are ordered 5.6 first because the doc numbers them that way and because Task 3 settles how a new param rides on every link, which Task 5 then does not have to rethink.

---

## Phase 1 — Part 5.6, sort

### Task 1: Sort the query from a whitelist, with a total order

**Description:** Add the `SORTS` whitelist to constants and teach `blunders.byCategory` to accept a `sort` input, choosing its `ORDER BY` text by key and appending the `blunder_id, kind` tie-breaker. No UI and no URL yet — the procedure gains an input with a default, so every existing caller keeps working unchanged.

**Acceptance criteria:**

- [ ] `SORTS` maps `worst` and `mildest` to `ORDER BY` fragments; `DEFAULT_SORT` is `worst`, matching today's behavior.
- [ ] The procedure input is `z.enum` over the `SORTS` keys with `.default(DEFAULT_SORT)`, so an unknown value is rejected before reaching SQL.
- [ ] Every generated query ends with the tie-breaker, making the row order total and stable across pages.

**Verification:**

- [ ] Types: `pnpm check-types` · Lint: `pnpm lint` · Build: `pnpm build`
- [ ] Manual: with `BLUNDERS_DB_PATH` set, page 5 and page 6 of `middle_game` share no `blunder_id`, and the union of all pages has no duplicates.
- [ ] Manual: `mildest` returns the reverse of `worst` at both ends of the list.

**Dependencies:** None
**Files likely touched:** `apps/web/lib/constants.ts`, `apps/web/server/router.ts`
**Estimated scope:** Small

### Task 2: Read the sort off the URL, on both sides

**Description:** Add `sortFrom` beside `pageFrom`, then read `?sort=` in the layout's prefetch and in the list's `useQuery` so both build the identical query key. After this, typing `?sort=mildest` into the address bar reorders the list — the same halfway point Part 5 reached before Part 5.5.

**Acceptance criteria:**

- [ ] `sortFrom` returns `DEFAULT_SORT` for absent, unknown or repeated values, exactly as `pageFrom` treats a non-page.
- [ ] `layout.tsx` and `blunder-list.tsx` pass the same `sort` into the same query options, so the prefetch hydrates instead of refetching.
- [ ] Typing `?sort=mildest` reorders the list; `?sort=nonsense` silently renders the default rather than erroring.

**Verification:**

- [ ] Types, lint, build as above.
- [ ] Manual: with the network tab open, loading `/middle_game?sort=mildest` shows no client refetch on hydration — a mismatched key shows up immediately as one.

**Dependencies:** Task 1
**Files likely touched:** `apps/web/lib/constants.ts`, `apps/web/app/[category]/layout.tsx`, `apps/web/app/[category]/blunder-list.tsx`
**Estimated scope:** Small

### Task 3: A control that writes the sort, and every link that carries it

**Description:** Add the sort control to the filter panel and make the pager, the row links and the pager's prefetch carry `sort` the way Part 5.5 taught them to carry filters. This is where Part 5.5's rule — every link is a write, and a link that omits a param clears it — gets applied to a param that has a non-empty default.

**Acceptance criteria:**

- [ ] Changing the sort resets to page 1, for the same reason changing a filter does: the page you were on may not exist under the new order.
- [ ] Turning a page, opening a row, and ticking a filter all preserve the active sort.
- [ ] The pager's hover prefetch uses the same key the click will land on, sort included.

**Verification:**

- [ ] Types, lint, build as above.
- [ ] Manual: set `mildest`, go to page 3, open a blunder, tick a severity — the sort survives all four navigations.
- [ ] Manual: the default sort round-trips without leaving a redundant `?sort=worst` on every URL.

**Dependencies:** Task 2
**Files likely touched:** `apps/web/app/[category]/blunder-filters.tsx`, `apps/web/app/[category]/subcomponents/blunder-list-pagination.tsx`, `apps/web/app/[category]/blunder-list.tsx`
**Estimated scope:** Medium

### Checkpoint: Part 5.6 works

- [ ] `pnpm check-types`, `pnpm lint` and `pnpm build` all pass
- [ ] Sort survives paging, filtering and opening a row
- [ ] No row repeats or disappears across a page boundary, including at the `blitz` ties at sorted rows 300/301
- [ ] Review with Adam before starting Part 5.7

---

## Phase 2 — Part 5.7, counts from the database

### Task 4: Count the buckets in the query

**Description:** Add a `GROUP BY` returning a count per `(kind, direction, severity)` bucket over the whole filtered set, reusing the same `WHERE` the list already builds, with the severity bands expressed as a `CASE` derived from `SEVERITY_BANDS`. Extend the procedure output so `byCategory` returns counts alongside blunders and total.

**Acceptance criteria:**

- [ ] Counts use the identical filter conditions as the list query, so they describe the list they will label.
- [ ] The severity `CASE` is generated from `SEVERITY_BANDS` rather than hand-written, matching how Part 5 derives its `WHERE` bands.
- [ ] Unfiltered `middle_game` returns the verified breakdown: checker 131/65/44/5 and cube offer 32/9/8/1, receive 3/3/3 — and the bucket counts sum to `total`.

**Verification:**

- [ ] Types, lint, build as above.
- [ ] Manual: compare the procedure's counts against the same `GROUP BY` run directly in `sqlite3` for `middle_game` filtered and unfiltered.
- [ ] Manual: `.output()` still parses — a drifting shape fails loudly here rather than in the browser.

**Dependencies:** None (independent of Tasks 1-3)
**Files likely touched:** `apps/web/server/router.ts`, `apps/web/lib/constants.ts`
**Estimated scope:** Medium

### Task 5: Headings that say "n of N"

**Description:** Pass the counts down through the list into the group headings so each one reads `Checker plays (37 of 245)`, with the page figure still from `.length` and the total from the query. The lookup has to key on the full path — a severity id like `mild` appears under checker, under cube/offer and under cube/receive — so the nested `BlunderListGroup` needs enough context to find its own number.

**Acceptance criteria:**

- [ ] Every kind, direction and severity heading shows both the page count and the filtered total.
- [ ] A bucket with rows on this page never shows a total smaller than its page count.
- [ ] Buckets with a non-zero total but no rows on this page are handled deliberately — decide whether they appear greyed or stay hidden, and say which in the doc.

**Verification:**

- [ ] Types, lint, build as above.
- [ ] Manual: on `middle_game` page 1 the checker heading reads `(39 of 245)` and the cube heading `(11 of 59)`.
- [ ] Manual: tick a severity filter and confirm both numbers move together.

**Dependencies:** Task 4
**Files likely touched:** `apps/web/app/[category]/blunder-list.tsx`, `apps/web/app/[category]/subcomponents/blunder-list-group.tsx`
**Estimated scope:** Medium

### Checkpoint: Part 5.7 works

- [ ] All three checks pass and the app runs
- [ ] Counts agree with `sqlite3` for at least two categories, filtered and unfiltered
- [ ] The thread Part 4.6 left open is genuinely closed — no heading count is page-local any more
- [ ] Review with Adam before writing the doc

---

## Phase 3 — Write it down

### Task 6: Write Part 5.6 into LEARNING.md

**Description:** Write the Part 5.6 section in the established shape — "The one idea", the file/job table, a numbered section per file with the code and "The pieces", then "Gotchas" — from the code proven in Phase 1. Organize it around the transferable concepts (a keyword cannot be bound; a sort without a unique tie-breaker is not a total order) rather than around this app's files.

**Acceptance criteria:**

- [ ] Every snippet is copied from the verified worktree, not retyped from memory.
- [ ] The tie numbers are the corrected, verified ones, not the "59" from the sketch.
- [ ] Gotchas cover at least: why the whitelist is a record and not a string; why the tie-breaker is two columns; why changing the sort resets the page.
- [ ] No code fence nested inside a blockquote, and prose is never hard-wrapped.

**Verification:**

- [ ] Manual: a reader with the Part 5.5 codebase can type the section start to finish with nothing missing and nothing out of order — the ordering complaint from BG-12 was that a prop arrived before the component that takes it.
- [ ] `pnpm format:check` passes.

**Dependencies:** Checkpoint after Task 3
**Files likely touched:** `LEARNING.md`
**Estimated scope:** Small (one file, substantial prose)

### Task 7: Write Part 5.7 into LEARNING.md

**Description:** Same shape, for the counts. The concepts to foreground: a count that describes the page is a different question from a count that describes the set, and deriving SQL from the same constant that drives the UI is what keeps the two from drifting.

**Acceptance criteria:**

- [ ] Every snippet comes from the verified worktree.
- [ ] The `middle_game` numbers used as examples are the real ones.
- [ ] Gotchas cover at least: keying a nested lookup by path rather than by id; counts following the filters; the cost of a second query per page load.

**Verification:**

- [ ] Manual: typeable start to finish in order, as above.
- [ ] `pnpm format:check` passes.

**Dependencies:** Checkpoint after Task 5, Task 6
**Files likely touched:** `LEARNING.md`
**Estimated scope:** Small (one file, substantial prose)

### Task 8: Reconcile the surrounding threads

**Description:** Fix everything elsewhere in the doc that these two parts change. Part 5's "Still open" loses its 5.6 and 5.7 paragraphs and keeps 5.8 and 5.9. Part 4.6's "Still open" claims a fix is coming in Part 5; it now arrives in 5.7 and should point there. The new sections each need their own "Still open" handing off to 5.8. The wrong "59" claim disappears with the paragraph that carried it, so check nothing else repeats it.

**Acceptance criteria:**

- [ ] No remaining forward reference describes 5.6 or 5.7 as unwritten.
- [ ] Part 4.6's dangling count thread points at Part 5.7 by name.
- [ ] `grep` finds no surviving instance of the incorrect tie figure.

**Verification:**

- [ ] Manual: read the three "Still open" sections in sequence and confirm the hand-offs are consistent.
- [ ] `pnpm format:check` passes.

**Dependencies:** Tasks 6 and 7
**Files likely touched:** `LEARNING.md`
**Estimated scope:** XS

### Checkpoint: Doc complete

- [ ] Parts 5.6 and 5.7 read in the same voice as 5 and 5.5
- [ ] Every claim with a number behind it was verified against the database
- [ ] Review with Adam

---

## Phase 4 — Land it

### Task 9: Revert the code, commit the doc, open the PR

**Description:** Revert every app change made for verification so the worktree is back to Part 5.5 code, leaving only `LEARNING.md` modified. Then commit, push, open the PR and move BG-14. The implementation itself is Adam's to type.

**Acceptance criteria:**

- [ ] `git status` shows `LEARNING.md` as the only tracked change — no app file survives from the verification build.
- [ ] The PR body says plainly that it ships the doc sections, and that the implementation is typed separately.
- [ ] BG-14 is moved and the PR attached.

**Verification:**

- [ ] All checks green on the pushed branch.

**Dependencies:** All previous
**Files likely touched:** none beyond the above
**Estimated scope:** XS

---

## Risks and Mitigations

| Risk                                                                       | Impact                                   | Mitigation                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| This worktree has no `.env.local`, so anything touching the database fails | High — blocks every verification step    | Set `BLUNDERS_DB_PATH` to the main checkout's `blunders.db` for this session; BG-13 / PR #14 fixes this properly |
| The prefetch key and the query key drift as `sort` is added                | Medium — silent double fetch, no error   | Task 2 checks the network tab explicitly; Part 5.5 already names this as a permanent two-place problem           |
| Sort text reaching SQL from anywhere but the whitelist                     | High — injection                         | Input is `z.enum` over the record's keys; the record is the only source of `ORDER BY` text                       |
| The counts query doubles the per-page database work                        | Low — SQLite, local, small data          | Measure once; consider folding `total` into the same `GROUP BY` since it is the sum of the buckets               |
| Doc numbers copied from the sketch rather than recomputed                  | Medium — a wrong claim in a teaching doc | Every figure in Tasks 6-7 traced to a query run in this session; the "59" error is already one instance          |
| Writing the code spoils the exercise Adam wants to type himself            | Medium — wasted or unwanted work         | Resolve Open Question 1 before Phase 3 ends, not after                                                           |

## Open Questions

- ~~**Does BG-14 want the code, the doc, or both?**~~ **Resolved:** Adam wires it up; this session writes the doc sections. The code is still built here to verify the snippets, then reverted.
- **Where does `sort` ride?** Extend `filterParams` into a general `viewParams` that also writes `sort`, or add a second builder. One builder means one place for every link to call and one place to forget nothing; two keeps the filter/sort distinction visible. Part 5.8 replaces both with `nuqs` regardless.
- **Should `total` collapse into the counts query?** The buckets sum to it, so keeping the separate `COUNT(*)` is arguably one query too many — but merging them couples pagination to bucketing.
- **Should the default sort be written into the URL?** Leaving `?sort=worst` off keeps URLs clean but means the control renders a value the URL does not contain; writing it makes every URL longer.
- **What happens to a bucket with a total but no rows on this page?** On a late page, most buckets are empty locally but non-zero overall. Showing them greyed is informative; hiding them is quieter. Task 5 needs an answer.
