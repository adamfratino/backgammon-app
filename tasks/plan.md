# Implementation Plan: Part 5.8 (the URL on a library)

Linear: [BG-15](https://linear.app/uiid/issue/BG-15/scope-out-58-for-learningmd) · branch `bg-15` · base `main` @ `3f0a6d4` · spec: [SPEC.md](../SPEC.md)

## Overview

Part 5.8 replaces every hand-written URL reader and writer from Parts 5 through 5.7 with `nuqs`: one parser map, from which the layout's prefetch (`createLoader`), the browser (`useQueryStates`) and every link (`createSerializer`) are derived. **Scope, decided:** same process as BG-14. The migration is built in this worktree only to prove every snippet against the real database and a running app, preserved on a local unpushed branch `bg-15-reference-impl`, then reverted. The PR carries `SPEC.md`, `tasks/` and `LEARNING.md`. Adam types the implementation.

The spec's assumptions stand unless a task below disproves one: URLs unchanged (`parseAsNativeArrayOf`, singular keys via `urlKeys`), a `createParser` page parser that keeps `pageFrom`'s behaviour, filters written in the constants' order, `history: "push"` for the panel, and links that read the URL themselves instead of receiving a `query` prop.

## What the codebase already gives us

- **Four readers and one builder, all in `lib/constants.ts`:** `pageFrom`, `sortFrom`, `filtersFrom`, `viewParams`. Their JSDoc states the guarantees the replacement has to keep — canonical order, unknown values dropped, default sort omitted from the URL.
- **Three places build the procedure input by hand:** `layout.tsx:26`, `blunder-list.tsx:31`, `blunder-list-pagination.tsx:48-53`. Part 5.5's gotcha "The prefetch key and the query key are two places, forever" is exactly this.
- **`proxy.ts` forwards the query string as `x-search`** because layouts get no `searchParams`. `nuqs` doesn't change that; `createLoader` accepts the header string directly (verified).
- **The router input already has the right names** — `page`, `kinds`, `severities`, `directions`, `sort` — so with `urlKeys` the parsed state spreads straight into `queryOptions` and `server/router.ts` needs no change.
- **This worktree has `apps/web/.env.local`** with `BLUNDERS_DB_PATH` (PR #14), so the app runs here without setup.

## Architecture decisions

- **Definitions live in a new `lib/search-params.ts`, imported from `nuqs/server`.** That entry point has no hooks, so the server layout and client components can share it. `constants.ts` keeps the whitelists and loses the URL functions — the whitelists are facts about backgammon, the parsers are facts about the URL.
- **The page parser is custom.** Stock `parseAsInteger` turns `?page=0` into `0`, which the router's `.min(1)` rejects. The replacement returns `null` for anything that is not an integer ≥ 1, and `nuqs` then falls back to the default.
- **Canonical on write, tolerant on read.** Stock native arrays keep URL order and duplicates. Rather than a custom multi-parser, the panel writes values filtered through the constants, so every URL the app generates is canonical. Hand-typed URLs still parse correctly and at worst miss the cache.
- **The parsed state is the procedure input.** `{ category, ...view }` everywhere; the three hand-written copies of the input object are deleted, not updated.
- **Doc sections are written only from code that ran**, and every behavioural claim — above all the shallow-routing one — is measured against a baseline taken from `3f0a6d4`, not reasoned about.

## Dependency graph

```
Task 0  baseline from 3f0a6d4 (SSR fingerprints + browser traces)
   │
Task 1  nuqs + NuqsAdapter + lib/search-params.ts ── parser equivalence vs old readers
   │
Task 2  read side: layout loader, blunder-list hook ── SSR matches baseline, no hydration refetch
   │
Task 3  write side: blunder-filters setter ── history, page reset, shallow measured
   │
Task 4  links: pager + row links serialize; query prop and old readers deleted
   │
Checkpoint → bg-15-reference-impl
   │
Task 5  Part 5.8 in LEARNING.md ── Task 6 TOC + hand-offs ── Task 7 extract fences, build on 3f0a6d4
   │
Task 8  revert apps/, commit docs ── ask before push / PR / Linear
```

Strictly sequential: each task's verification relies on the previous one's code existing.

---

## Phase 0 — Baseline

### Task 0: Record what today's code actually does

**Description:** In a throwaway worktree at `3f0a6d4` (`/tmp/bg15-base`, its own dev server on another port), fingerprint the server-rendered list for every URL in the spec's equivalence table, and trace in a real browser what a filter click, a sort change, a pager click and a row click each do: resulting URL, `history.length`, RSC requests, tRPC requests. Nothing in the repo changes.

**Acceptance criteria:**

- [ ] A saved fingerprint per URL: kind/group headings and the ordered row ids in the server HTML.
- [ ] A saved trace per interaction, including whether today's `router.push` triggers an RSC request and a server-side re-run of the layout's prefetch.

**Verification:**

- [ ] Re-running the capture produces identical output.

**Dependencies:** None
**Files likely touched:** none in the repo (`/tmp` only)
**Estimated scope:** S

---

## Phase 1 — Reference implementation

### Task 1: One definition

**Description:** `pnpm --filter web add nuqs`, wrap the root layout in `NuqsAdapter`, and write `lib/search-params.ts` with the parser map, `urlKeys`, `loadView` and `serializeView`. Old readers stay for now so they can be compared against directly.

**Acceptance criteria:**

- [ ] For every URL in the equivalence table plus a set of malformed inputs, `loadView(url)` equals `{ page: pageFrom, ...filtersFrom, sort: sortFrom }` — as sets for the arrays, exactly for the rest.
- [ ] For canonical state, `serializeView(state)` equals what `viewParams` plus the page produces today.

**Verification:**

- [ ] A probe script importing both implementations passes.
- [ ] `pnpm check-types` · `pnpm lint`

**Dependencies:** Task 0
**Files likely touched:** `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/app/layout.tsx`, `apps/web/lib/search-params.ts`
**Estimated scope:** S

### Task 2: The read side

**Description:** The layout hands the `x-search` header to `loadView`; the list replaces `useSearchParams` and three readers with `useQueryStates(viewParsers, { urlKeys })`. Both spread the result into `queryOptions`, so the key is built from one definition.

**Acceptance criteria:**

- [ ] Every URL's SSR fingerprint matches Task 0's.
- [ ] A cold load of a filtered, sorted, paged URL makes no tRPC request in the browser.

**Verification:**

- [ ] Fingerprint diff against baseline is empty.
- [ ] Browser trace: zero `/api/trpc` requests on first load.

**Dependencies:** Task 1
**Files likely touched:** `apps/web/app/[category]/layout.tsx`, `apps/web/app/[category]/blunder-list.tsx`
**Estimated scope:** S

### Task 3: The write side

**Description:** `blunder-filters.tsx` drops `useRouter`, `show` and `toggle`'s `URLSearchParams` handling for the `useQueryStates` setter: one call per change that writes the canonical filter set (or the sort) and `page: null`, with `history: "push"`. Measure shallow against Task 0's trace before deciding it.

**Acceptance criteria:**

- [ ] Ticking a filter or choosing a sort lands on page 1, in one history entry, with the URL in canonical order.
- [ ] Back returns to the previous view, with the list and the checkboxes both matching it.
- [ ] The shallow vs. `shallow: false` decision is recorded with the trace that justifies it.

**Verification:**

- [ ] Browser script: from page 3, tick a severity → URL, `history.length`, rendered rows; press back → previous URL and rows.
- [ ] Types, lint.

**Dependencies:** Task 2
**Files likely touched:** `apps/web/app/[category]/blunder-filters.tsx`
**Estimated scope:** S

### Task 4: The links, and the deletions

**Description:** The pager builds each `href` with `serializeView` and prefetches with `{ category, ...view, page: n }`; `blunder-list-links.tsx` reads the view itself and serializes onto `/${category}/${id}`, so the `query` prop leaves `blunder-list.tsx` and `blunder-list-group.tsx`. Then delete `pageFrom`, `sortFrom`, `filtersFrom`, `viewParams` and anything only they used.

**Acceptance criteria:**

- [ ] Paging and opening a row preserve filters and sort; a row link carries the page only when it isn't 1.
- [ ] Hovering a page number and then clicking it makes one tRPC request, not two.
- [ ] The spec's grep for `pageFrom|sortFrom|filtersFrom|viewParams|useSearchParams|URLSearchParams|router\.push` over `app/` and `lib/` finds nothing.

**Verification:**

- [ ] Browser script: set a filter and sort, page to 3, open a row, check the URL; hover-then-click trace.
- [ ] `pnpm check-types` · `pnpm lint` · `pnpm build`

**Dependencies:** Task 3
**Files likely touched:** `subcomponents/blunder-list-pagination.tsx`, `subcomponents/blunder-list-links.tsx`, `subcomponents/blunder-list-group.tsx`, `app/[category]/blunder-list.tsx`, `lib/constants.ts`
**Estimated scope:** M

### Checkpoint: the migration works

- [ ] `pnpm check-types`, `pnpm lint`, `pnpm build` pass
- [ ] Every URL in the equivalence table matches baseline; every interaction trace is equal or better, with differences explained
- [ ] Committed to local branch `bg-15-reference-impl`, not pushed

---

## Phase 2 — Write it down

### Task 5: Part 5.8 in LEARNING.md

**Description:** House shape — the one idea, file table, one section per file in typing order (install and adapter, `search-params.ts`, layout, list, filters, pager, links and group, then the deletions from `constants.ts`), gotchas, still open. The comparison table is old function → new definition. Server side stays out.

**Acceptance criteria:**

- [ ] Every block is copied from `bg-15-reference-impl`; every changed file has its whole file.
- [ ] Gotchas cover, at minimum: the page parser (`?page=0`, measured); order and duplicates in native arrays; the comma parser breaking existing URLs; layouts still needing `proxy.ts`; whatever Task 3 found about shallow updates.
- [ ] No hard-wrapped prose, no fence inside a blockquote, no TypeScript tangents.

**Verification:**

- [ ] `pnpm format:check`

**Dependencies:** Checkpoint
**Files likely touched:** `LEARNING.md`
**Estimated scope:** M (one file, substantial)

### Task 6: TOC and hand-offs

**Description:** Add Parts 5.6, 5.7 and 5.8 to the table of contents (it stops at 5.5 today). Make Part 5.7's "Still open" consistent with 5.8 existing, and give 5.8 its own hand-off to 5.9.

**Acceptance criteria:**

- [ ] Every TOC anchor resolves to a real heading.
- [ ] No forward reference describes 5.8 as unwritten.

**Verification:**

- [ ] Script: every `(#anchor)` in the TOC matches a GitHub-slugged heading.

**Dependencies:** Task 5
**Files likely touched:** `LEARNING.md`
**Estimated scope:** XS

### Task 7: Prove the doc, not the branch

**Description:** Extract Part 5.8's fenced blocks from `LEARNING.md` (anchored on real heading lines), apply them to a clean `3f0a6d4` worktree, and build. Re-run the SPEC URL table against that build.

**Acceptance criteria:**

- [ ] The extracted build passes check-types, lint and build.
- [ ] The extracted build's fingerprints match baseline.

**Verification:**

- [ ] Extraction script plus the same fingerprint script as Task 0.

**Dependencies:** Tasks 5, 6
**Files likely touched:** none in the repo
**Estimated scope:** S

---

## Phase 3 — Land it

### Task 8: Revert, commit, then ask

**Description:** Reset `apps/`, `pnpm-lock.yaml` and anything else touched to `3f0a6d4`, remove the `/tmp` worktrees, commit `SPEC.md`, `tasks/` and `LEARNING.md`. Stop and ask before pushing, opening the PR or moving BG-15.

**Acceptance criteria:**

- [ ] `git diff 3f0a6d4 --stat` lists only `SPEC.md`, `tasks/plan.md`, `tasks/todo.md`, `LEARNING.md`.
- [ ] `git worktree list` shows no `/tmp` worktrees.

**Dependencies:** Task 7
**Estimated scope:** XS

---

## Risks and mitigations

| Risk                                                                                                     | Impact                                             | Mitigation                                                                                   |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A shallow URL update and the layout's `HydrationBoundary` disagree, causing a flash or a stale list      | Medium — visible regression                        | Task 3 traces it against baseline; `shallow: false` is the fallback                          |
| `nuqs` rate-limits URL updates, so a filter and a page reset land as two history entries or out of order | Medium — back button breaks                        | Set both in one setter call; Task 3 checks `history.length` explicitly                       |
| The doc claims a behaviour change that was never measured (e.g. "no longer round-trips the server")      | High — a wrong claim in a teaching doc             | Task 0 baseline; no behavioural sentence goes in without a trace behind it                   |
| Row links become hook-callers in a file with no `"use client"`                                           | Low — breaks only if a server component imports it | It is only reached through client components; mention it in "The pieces" rather than hide it |
| Snippets drift from the reference branch while writing                                                   | Medium — Adam types code that doesn't compile      | Task 7 builds from the doc itself, not the branch                                            |
| `pnpm add` leaves the lockfile changed after revert                                                      | Low — noisy PR                                     | Task 8 resets `pnpm-lock.yaml` and checks `git diff --stat` against the base                 |

## Open questions

- **Shallow or not?** Decided by Task 3's trace, and it depends on Task 0's finding about what `router.push` does today.
- **Does the pager still need `filters` and `sort` props once it can read the URL itself?** Leaning no, for the same reason as the row links; settled while writing Task 4, and the doc says which.
