# TODO: Part 6 — Mutations (notes on a blunder)

BG-16 · branch `bg-16` · full detail in [tasks/plan.md](plan.md)

**Storage decision (approved 2026-09-12):** notes live in their own SQLite file next to `blunders.db`, behind an async `NotesStore` interface injected as `ctx.notes`. No foreign key, no cross-file join. Verified: a `CASCADE` foreign key is wiped by the scraper's `INSERT OR REPLACE`, and `ATTACH` on the read-only connection cannot write.

**Deliverable:** server changes ship in the PR; client code is built only to verify `LEARNING.md`, kept on `bg-16-reference-impl`, and typed by Adam.

## Phase 1 — Save one note and read it back

- [x] **Task 1 — The notes store behind an interface.** `server/notes.ts`: async `get` / `save` / `remove` / `ids`, lazy open, WAL, `CREATE TABLE IF NOT EXISTS`. Opened beside `blunders.db` in `server/db.ts`, wired as `ctx.notes`. _(S · `server/notes.ts`, `server/db.ts`, `server/trpc.ts`, `scripts/setup-worktree.ts` · deps: none)_
- [x] **Task 2 — Read and write procedures.** `notes.byBlunder`, `notes.save`, `notes.ids`, each with `.output()`; a blank body calls `remove`, so that rule lives once rather than per backend; `NOT_FOUND` for an unknown blunder; `Map`-backed swap proves the seam. _(S · `server/router.ts` · deps: 1)_
- [ ] **Task 3 — A textarea that saves.** Prefetched and hydrated `NoteEditor` on the blunder page; `useMutation`, pending and error states, `setQueryData`. _(S · `[blunderId]/page.tsx`, `note-editor.tsx` · deps: 2)_

### Checkpoint: Phase 1

- [ ] `pnpm check-types`, `pnpm lint`, `pnpm build` pass
- [ ] Note survives reload, navigation, and a scraper `load`
- [ ] `blunders.db` still read-only; no notes SQL in `router.ts`
- [ ] Reviewed with Adam

## Phase 2 — The mutation grows up

- [ ] **Task 4 — Optimistic autosave.** Debounce plus flush on blur and unmount; `scope` per blunder; `variables` optimistic state with the `onMutate` variant built for comparison. _(S · `note-editor.tsx` · deps: 3)_
- [ ] **Task 5 — The list knows which blunders have notes.** Layout prefetches `notes.ids`; list builds a `Set`; row marker; save invalidates `notes.ids`; `byCategory` untouched. _(M · `layout.tsx`, `blunder-list.tsx`, `blunder-list-links.tsx`, `note-editor.tsx` · deps: 2, 4)_

### Checkpoint: Phase 2

- [ ] Checks pass, app runs
- [ ] Throttled autosave never loses or reorders an edit
- [ ] Marker and editor agree after every save and clear
- [ ] Reviewed with Adam

## Phase 3 — Write it down

- [ ] **Task 6 — Preserve the reference implementation, revert the client.** Local `bg-16-reference-impl`; `apps/web/app/` back to `main`; still builds. _(XS · deps: Checkpoint 2)_
- [ ] **Task 7 — Write Part 6.** "Already done for you" preface plus one paragraph on the separate file; client sections in house shape; snippets built from the doc with `NOTES_DB_PATH` in `/tmp`. _(S · `LEARNING.md` · deps: 6)_
- [ ] **Task 8 — Reconcile the threads.** Reword `:3514` / `:3518` (Part 6 is not revisiting the bands); check every Part 6 hand-off; Contents gains 5.6, 5.7, 6; intro mentions the notes file. _(XS · `LEARNING.md` · deps: 7)_

### Checkpoint: Doc complete

- [ ] Same voice as Part 5.x
- [ ] Every snippet built from the doc's own text
- [ ] `pnpm format:check` passes
- [ ] Reviewed with Adam

## Phase 4 — Land it

- [ ] **Task 9 — Commit, PR, Linear.** Server files, `LEARNING.md`, `tasks/*` only; decision posted to BG-16 with a link to BG-7; ticket moved. _(XS · deps: all)_

## Open questions

- [x] ~~Q1 — Where does `notes.db` live?~~ **Next to the open `blunders.db`**, so shared in the main checkout. `NOTES_DB_PATH` overrides it.
- [x] ~~Q2 — First-slice save interaction?~~ **Blur plus a button** in Task 3; autosave in Task 4.
- [x] ~~Q3 — Doc numbering?~~ **6 / 6.5 / 6.6.**
- [x] ~~Q4 — List marker in scope?~~ **Yes.**
- [x] ~~Q5 — Max note length?~~ **2,000 characters**, as `NOTE_MAX_LENGTH` in `lib/constants.ts`.
