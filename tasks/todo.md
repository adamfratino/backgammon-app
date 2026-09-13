# TODO: Part 5.8 (the URL on a library)

BG-15 · branch `bg-15` · spec in [SPEC.md](../SPEC.md) · full detail in [tasks/plan.md](plan.md)

**Deliverable: `LEARNING.md` Part 5.8, plus `SPEC.md` and this plan.** The migration was built only to verify the snippets and is preserved on local branch `bg-15-reference-impl` (`c36c498`, not pushed); `bg-15` carries documents only. Adam types the implementation himself.

## Phase 0 — Baseline

- [x] **Task 0 — Record what today's code actually does.** SSR fingerprints for 15 URLs and browser traces from a clean `3f0a6d4` in `/tmp/bg15-base`.

## Phase 1 — Reference implementation

- [x] **Task 1 — One definition.** `nuqs`, `NuqsAdapter`, `lib/search-params.ts`; equivalence probe against the old readers passes for 23 URLs.
- [x] **Task 2 — The read side.** `loadView` in the layout, `useView` in the list; SSR matches baseline, no data request on cold load.
- [x] **Task 3 — The write side.** Panel writes through the `useView` setter with `history: "push"`; the open blunder stays open (Adam's decision); no server round trip per click.
- [x] **Task 4 — The links, and the deletions.** Pager and row links serialize; `query` prop gone; old readers deleted; grep clean.

### Checkpoint: the migration works

- [x] `pnpm check-types`, `pnpm lint`, `pnpm build` pass
- [x] URL list matches baseline; every trace equal to baseline or the difference is explained in SPEC.md
- [x] Committed to local `bg-15-reference-impl`, not pushed
- [x] Part 5.9 compatibility confirmed with a throwaway sidebar link (needs `<Suspense>`), since reverted

## Phase 2 — Write it down

- [x] **Task 5 — Part 5.8 in LEARNING.md.** Drafted from the reference files, in typing order; 5.5 and 5.6 gotchas point at the reversal.
- [x] **Task 6 — TOC and hand-offs.** TOC gains 5.6, 5.7, 5.8; every entry's text and anchor checked against the real headings, which also fixed Part 5's `constants.ts` entry (it pointed at Part 3.5's).
- [x] **Task 7 — Prove the doc, not the branch.** Every fence in Part 5.8 matches the reference; the app built from the doc alone on clean `3f0a6d4` passes types, lint and build, and its SSR (15 URLs) and traces (13 steps plus the blunder-open sequence) are identical to the reference.

## Phase 3 — Land it

- [ ] **Task 8 — Commit, then ask.** Remove `/tmp` worktrees, stop dev servers, commit `SPEC.md`, `tasks/` and `LEARNING.md`; ask before push / PR / Linear.

## Decisions

- [x] ~~Open blunder on filter/sort change?~~ **Stays open** — Adam, 2026-09-12.
- [x] ~~Shallow or `shallow: false`?~~ **Shallow (the default)** — measured: no RSC request per click, same rows and history as baseline.
- [x] ~~Does the pager keep `filters`/`sort`/`page` props?~~ **No** — it reads the URL and builds on `usePathname()`.
