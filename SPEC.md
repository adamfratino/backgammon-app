# Spec: Part 5.8 of LEARNING.md — the URL on a library

Linear: [BG-15](https://linear.app/uiid/issue/BG-15/scope-out-58-for-learningmd) · branch `bg-15` · base `main` @ `3f0a6d4`

## Objective

Write Part 5.8 of `LEARNING.md`: replace the hand-rolled URL state from Parts 5 through 5.7 with `nuqs`, so each query param is defined once and the layout's prefetch, the browser, and every link are all derived from that one definition.

The reader is Adam, who types each part into the app by hand from full working code. The lesson is the diff against what he already typed — the "older method" for this part is his own code — so the transferable idea is **URL state as a schema: one parser map that both parses and serializes**, and the doc should make the before/after concrete rather than describe the library in the abstract.

Four "Still open" sections already promise this part (`LEARNING.md:2485`, `2943`, `3336`, `3524`), and Part 5.5's gotcha "The prefetch key and the query key are two places, forever" (`LEARNING.md:2921-2925`) names it as the structural fix. Part 5.8 pays both off.

## What the user sees

Almost nothing changes on screen, which is the point of a refactor part. One thing changes on purpose:

- **An open blunder stays open when you change the filters or the sort.** Today, ticking "Severe" or choosing "Mildest first" while reading a blunder closes it and shows the filtered list. After 5.8 the blunder stays open and the list beside it updates to page 1 of the new filters. If the open blunder is in the new list it stays highlighted; if it isn't (filtered out, or on another page) nothing in the list is highlighted. Back undoes one change at a time, all the way to where you started. _Decided by Adam, 2026-09-12: "the current blunder should always stay open, regardless of what has been chosen in the filters, sort, etc."_ This reverses the "Changing a filter/sort closes the open blunder" gotchas in Parts 5.5 and 5.6, and 5.8 says so.
- **Everything else is identical:** the same URLs work, paging and opening a row keep the filters and sort, filters and sort changes reset to page 1, and back/forward behave as today.
- **Part 5.9 is unaffected.** Clicking another category in the sidebar will carry the filters and sort, reset to page 1, and close the open blunder (it belongs to the old category). Confirmed with a throwaway prototype on top of this design — see below.

### What gets deleted

| today (Parts 5–5.7)                                            | where                                        | replaced by                                                        |
| -------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| `pageFrom`, `sortFrom`, `filtersFrom`, `BlunderFilters`        | `lib/constants.ts`                           | one parser per param in `lib/search-params.ts`                     |
| `viewParams`                                                   | `lib/constants.ts`                           | `serializeView` (`createSerializer`)                               |
| `new URLSearchParams(x-search)` + three readers                | `[category]/layout.tsx`                      | `loadView` (`createLoader`), fed the header string directly        |
| `useSearchParams` + three readers                              | `blunder-list.tsx`, `blunder-filters.tsx`    | `useView` (`useQueryStates`)                                       |
| `useRouter`, `show`, `toggle` and the hand-built query         | `blunder-filters.tsx`                        | the `useView` setter                                               |
| `` `?${params}` `` and the `query` string prop                 | pagination, `blunder-list-group`, `-links`   | `serializeView`, called where the link is built                    |
| `filters`, `sort`, `page` props on the pager                   | `blunder-list.tsx`, pagination               | the pager reads the URL itself                                     |
| `{ category, page, ...filters, sort }` written out three times | `layout.tsx`, `blunder-list.tsx`, pagination | `{ category, ...view }` — the parsed view _is_ the procedure input |

### In scope

- `pnpm --filter web add nuqs` (2.10.1, current `latest`).
- `app/layout.tsx` — wrap in `NuqsAdapter` from `nuqs/adapters/next/app`.
- New `apps/web/lib/search-params.ts`: the parser map, `urlKeys`, `loadView`, `serializeView`, `useView`.
- `lib/constants.ts`, `[category]/layout.tsx`, `blunder-list.tsx`, `blunder-filters.tsx`, `subcomponents/blunder-list-pagination.tsx`, `subcomponents/blunder-list-group.tsx`, `subcomponents/blunder-list-links.tsx`.
- The doc: Part 5.8 itself, the table of contents (which currently stops at Part 5.5 — 5.6 and 5.7 are missing too), and Part 5.7's "Still open" hand-off.

### Out of scope

- **Part 5.9** — the sidebar carrying filters across categories. `category-nav.tsx` is untouched.
- **`server/router.ts`** — no change. The input is already `{ category, page, kinds, severities, directions, sort }`, and `urlKeys` makes the parsed view match those names.
- **`proxy.ts`** — stays. Layouts still receive no `searchParams`; `createSearchParamsCache` needs a page's `searchParams` and so does not apply. Worth one paragraph.
- Any visual change beyond the open-blunder decision above, and Part 6.

## Decisions

1. **URLs keep their format.** Arrays use `parseAsNativeArrayOf` so repeated keys (`?kind=cube&kind=checker`) keep working; the URL keeps singular names via `urlKeys`. The comma parser most examples show would silently drop filters from every existing URL (measured below).
2. **`?page=` keeps today's rules** via a `createParser` page parser: anything that is not an integer ≥ 1 is page 1.
3. **`page` is last in the parser map,** so every URL the app generates is byte-identical to what `viewParams` produced.
4. **Filters are canonical on write.** Each checkbox group builds its next selection by walking the options, so the app only ever writes values in the constants' order, without duplicates. A hand-typed out-of-order URL still works; links built from it keep its order.
5. **The filter panel uses the `useView` setter** (not `router.push`), which only rewrites the query string — that is what keeps the open blunder open. `history: "push"` is set once, inside `useView`, so each change is one back-button step.
6. **Links read the URL themselves.** The pager and row links call `useView` and `serializeView` directly; the `query` prop through `blunder-list-group.tsx` and the pager's `filters`/`sort`/`page` props are deleted. The pager serializes onto `usePathname()`, so paging while a blunder is open keeps it open (as today).
7. **`useView` lives in the same file as the loader and serializer,** importing the hook from `nuqs` and the rest from `nuqs/server`. `nuqs`'s root entry is `"use client"`, but the server layout only calls `loadView`, and the build passes.

## Verified facts

All run on 2026-09-12 against `nuqs@2.10.1`, the real database, and a reference implementation of the decisions above (local branch `bg-15-reference-impl`, `c36c498`, not pushed), compared with a clean checkout of `3f0a6d4`.

**The library, in isolation**

- Peers fit: `next >=14.2.0`, `react >=18.2.0 || ^19` against Next 16.3.4 / React 19.2.8.
- Stock `parseAsInteger`: `?page=0` → `0`, `-3` → `-3`, `2.5` → `2`, `abc` → `1`. `0` and `-3` would reach the router's `.min(1)` and render "Could not load blunders". Hence decision 2.
- `parseAsNativeArrayOf(parseAsStringLiteral(...))` drops unknown values but keeps URL order and duplicates: `?kind=cube&kind=bogus&kind=cube` → `["cube", "cube"]`.
- `parseAsArrayOf` is comma-separated: the repo's `?kind=cube&kind=checker` → `["cube"]` only.
- `createLoader` accepts `"?page=4"`, `"page=4"` and a `URLSearchParams`, so the `x-search` header goes straight in.
- `createSerializer` omits defaults (`page` 1, `[]`, `"worst"`), accepts a base path, and treats `page: null` as "remove".

**Old readers vs. the new definitions** — 23 URLs including malformed ones: every read is equivalent (same values; arrays equal as sets), and for every state the app writes today the serializer produces the identical string. The only differences are array order and duplicates on hand-typed URLs.

**The running app, against baseline**

- Server HTML for 15 URLs (plain, malformed pages, repeated and bogus filters, sorts, filtered pages, a blunder detail page): identical rows, headings, checkboxes, loading and empty states. Pager `href`s are now full paths and leave off `page=1` — same destinations.
- Cold load of a filtered, sorted, paged URL: zero data requests from the browser (the prefetch hydrates).
- Filter and sort clicks: same URL, same history length, same rows as baseline — but no server round trip any more. Baseline makes an RSC request plus a data fetch per click; the reference makes only the data fetch.
- Hover a page number, then click it: one data fetch, as baseline.
- Blunder open + tick Severe + choose Mildest + tick Cube: the blunder stays open through all three, the list updates each time, and back walks the three changes in reverse to the original page 2. Baseline closes the blunder on the first click.
- When the setter adds a param that wasn't in the URL, it goes on the end (`?severity=severe&sort=mildest&kind=cube`) rather than in parser-map order. Harmless — the cache key doesn't depend on param order — but visible.
- `pnpm check-types`, `pnpm lint`, `pnpm build` pass; the route table matches `main` (`/` and `/_not-found` still static).

**Part 5.9 compatibility** — a throwaway sidebar link (`serializeView(`/${category}`, { ...view, page: null })`) on top of the reference, since reverted:

- From `/middle_game?severity=severe&sort=mildest&page=2`, clicking `blitz` lands on `/blitz?severity=severe&sort=mildest`, page 1, correct list and checkboxes; back returns to page 2; the links are already correct in the server HTML.
- **5.9 will need a `<Suspense>` boundary** (plain `/${category}` link as the fallback) around that link, because it reads the URL from the root layout, which static pages also render. Without it `pnpm build` fails on `/404`; with it the build passes. This is a note for 5.9, not a constraint on 5.8.

## Tech Stack

Next.js 16.3.4 (App Router, `proxy.ts`), React 19.2.8, TypeScript 7.0.2, tRPC 11.18 with `@trpc/tanstack-react-query`, TanStack Query 5.102, Zod 4.5.4, SQLite via `@repo/galaxy-scraper`, pnpm 10.13.1 + Turbo, Node ≥ 24. Adds `nuqs` 2.10.1.

## Commands

```
Install:      pnpm install                      # postinstall writes apps/web/.env.local
Add nuqs:     pnpm --filter web add nuqs
Dev:          pnpm dev                          # http://localhost:3000
Types:        pnpm check-types
Lint:         pnpm lint
Build:        pnpm build
Format:       pnpm format:check                 # covers LEARNING.md and SPEC.md
Reference:    git diff bg-15-reference-impl -- apps/
```

## Project Structure

```
apps/web/
  proxy.ts                           → forwards the query string as x-search (unchanged)
  app/layout.tsx                     → root layout; gains NuqsAdapter
  app/[category]/layout.tsx          → server prefetch; readers → loadView
  app/[category]/blunder-list.tsx    → list; useSearchParams → useView
  app/[category]/blunder-filters.tsx → panel; router.push → the useView setter
  app/[category]/subcomponents/      → pager, group, links; hand-built hrefs → serializeView
  lib/constants.ts                   → whitelists stay; URL readers and builder are deleted
  lib/search-params.ts               → new: parsers, urlKeys, loadView, serializeView, useView
  server/router.ts                   → unchanged
LEARNING.md                          → Part 5.8, TOC, Part 5.7 hand-off
```

## Code Style

The heart of the part, as built and verified on `bg-15-reference-impl`:

```ts
/**
 * Every param the list reads, defined once. The keys are the procedure's input
 * names, so the parsed view spreads straight into `queryOptions`, and their order
 * here is the order they are written into the URL.
 */
export const viewParsers = {
  kinds: parseAsNativeArrayOf(parseAsStringLiteral(KINDS)).withDefault([]),
  severities: parseAsNativeArrayOf(parseAsStringLiteral(SEVERITIES)).withDefault([]),
  directions: parseAsNativeArrayOf(parseAsStringLiteral(DIRECTIONS)).withDefault([]),
  sort: parseAsStringLiteral(SORT_IDS).withDefault(DEFAULT_SORT),
  page: parseAsPage.withDefault(1),
};

export const loadView = createLoader(viewParsers, { urlKeys: viewUrlKeys });
export const serializeView = createSerializer(viewParsers, { urlKeys: viewUrlKeys });
export const useView = () => useQueryStates(viewParsers, { urlKeys: viewUrlKeys, history: "push" });
```

Doc conventions, from the parts already written:

- `## The one idea`, a `file | job` table, one numbered `##` section per file, `## Gotchas`, `## Still open`.
- Every changed file gets its whole file (or, for a small change, the changed lines, said explicitly), then `### The pieces`.
- Sections in typing order: install and adapter, `search-params.ts`, then consumers, then the deletions from `constants.ts`.
- Prose is never hard-wrapped. No code fence inside a blockquote. Type annotations stay in the code; explanations of them do not. Server side stays out.

## Testing Strategy

No test runner in the repo; none added. Verification is what was run above, repeated against the doc itself when it is written:

- **Parser equivalence** — old readers vs. `loadView`/`serializeView` over the malformed-URL list.
- **Static** — `pnpm check-types`, `pnpm lint`, `pnpm build`.
- **Rendering** — server HTML fingerprints for the URL list, diffed against `3f0a6d4`.
- **Behaviour** — scripted browser traces: cold load, filter/sort clicks, hover-then-click, open a row, back ×4, and the blunder-open sequence.
- **The doc itself** — fenced blocks extracted from `LEARNING.md` onto a clean `3f0a6d4` checkout must pass all of the above. `pnpm format:check` passes.

## Boundaries

- **Always:** build and run every snippet before it goes in the doc; show whole files; order sections so nothing is used before it is typed; keep the server side out of the doc; describe behaviour decisions as what the screen does.
- **Ask first:** changing any URL's format or param names; touching `server/router.ts`, `proxy.ts` or `category-nav.tsx`; adding any dependency besides `nuqs`; starting to write the doc section under this ticket; pushing, opening a PR, or moving BG-15.
- **Never:** commit app code to `bg-15`; push `bg-15-reference-impl`; commit `.env.local` or the database; hard-wrap prose; nest a code fence in a blockquote.

## Success Criteria

For this ticket (BG-15, scoping):

- [x] Every open question resolved, with the behaviour decision made by Adam and everything else measured.
- [x] 5.9 compatibility confirmed.
- [ ] This spec approved, and `tasks/plan.md` / `tasks/todo.md` updated to match it.

For Part 5.8 itself, whenever it is written:

- [ ] After typing the part, `grep -rnE 'pageFrom|sortFrom|filtersFrom|viewParams|useSearchParams|URLSearchParams|router\.push|BlunderFilters' apps/web/app apps/web/lib` finds nothing.
- [ ] Server HTML for the URL list matches `3f0a6d4` (pager `href` format aside).
- [ ] A filtered, sorted, paged URL loaded cold makes no data request from the browser.
- [ ] Filter and sort changes reset to page 1, keep an open blunder open, and are each one back-button step; paging and opening a row keep the filters and sort.
- [ ] `pnpm check-types`, `pnpm lint`, `pnpm build` and `pnpm format:check` pass.
- [ ] Part 5.8's fenced blocks, extracted from `LEARNING.md` and applied to `3f0a6d4`, build and pass the traces.
- [ ] The TOC lists Parts 5.6, 5.7 and 5.8; Parts 5.5 and 5.6's "closes the open blunder" gotchas are pointed at 5.8's reversal; 5.8's "Still open" hands off to 5.9, including the Suspense note.

## Open Questions

None blocking. One for whoever writes 5.9: whether the sidebar link's `<Suspense>` fallback (a plain link with no filters) is acceptable for the moment before hydration on static pages, or whether those pages should render no sidebar links until then.
