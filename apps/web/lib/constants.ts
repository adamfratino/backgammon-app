import type { PaletteColor } from "@uiid/design-system";

export const PER_PAGE = 15;
export const PRIMARY_SIDEBAR_MAXWIDTH = 260;
export const SECONDARY_SIDEBAR_MAXWIDTH = 480;

/**
 * How many page numbers the paginator shows on each side of the current one.
 * The first and last pages are always drawn, so 1 is the narrowest window that
 * still shows where you are: `1 … 15 16 17 … 31`.
 */
export const PAGE_SPREAD = 1;

/**
 * A note is a scratchpad, not a document. The server rejects anything longer,
 * and the textarea stops typing there.
 */
export const NOTE_MAX_LENGTH = 2000;

export const KINDS = ["checker", "cube"] as const;

export type BlunderKind = (typeof KINDS)[number];

export const CRAWFORD_STATE = [
  { id: "none", label: "none" },
  { id: "crawford", label: "on crawford" },
  { id: "post_crawford", label: "post-crawford" },
] as const;

export type CrawfordState = (typeof CRAWFORD_STATE)[number]["id"];

/**
 * What the Crawford filter offers, in the order a match runs through them.
 *
 * These ids are the filter's own rather than the `crawford_state` column's. That
 * column calls the ordinary case `none`, which in a URL would read as "no
 * Crawford filter" instead of "before the Crawford game" — and the labels above
 * are prose fragments for a sentence on the blunder page ("you're on crawford"),
 * not the standalone names a dropdown needs.
 *
 * Each carries the line the popup stacks under its name. The three differ by
 * what the cube is doing, which is the part that changes how a position should
 * be played, so each description says that rather than restating the name.
 */
export const CRAWFORD_FILTERS = [
  {
    id: "pre",
    label: "Pre-Crawford",
    description: "Neither player at match point — the cube is live",
  },
  {
    id: "crawford",
    label: "Crawford game",
    description: "The one game after a player reaches match point — no doubling",
  },
  {
    id: "post",
    label: "Post-Crawford",
    description: "Every game after the Crawford game — the cube is live again",
  },
] as const;

export type CrawfordFilter = (typeof CRAWFORD_FILTERS)[number]["id"];

export const SEVERITY_BANDS = [
  { id: "catastrophic", label: "Catastrophic", min: 0.4 },
  { id: "severe", label: "Severe", min: 0.2 },
  { id: "moderate", label: "Moderate", min: 0.1 },
  { id: "mild", label: "Mild", min: 0 },
] as const;

export type BlunderSeverity = (typeof SEVERITY_BANDS)[number]["id"];

export function severityOf(errorMagnitude: number): BlunderSeverity {
  const band = SEVERITY_BANDS.find(({ min }) => errorMagnitude >= min);
  return band?.id ?? "mild";
}

/**
 * No green: no blunder is fine, so even the mildest band stays neutral. It sits
 * here rather than beside the table because the Severity filter draws the same
 * badges, and a band that is red in one place has to be red in the other.
 */
export const SEVERITY_COLOR: Record<BlunderSeverity, PaletteColor> = {
  catastrophic: "red",
  severe: "orange",
  moderate: "yellow",
  mild: "neutral",
};

export const CUBE_ACTION = [
  "double_accepted",
  "double_requested",
  "double_rejected",
  "dice_rolled",
] as const;

export type BlunderCubeAction = (typeof CUBE_ACTION)[number] | null;

export const CUBE_DIRECTIONS = [
  { id: "offer", label: "Offering the cube" },
  { id: "receive", label: "Being offered the cube" },
] as const;

export type CubeDirection = (typeof CUBE_DIRECTIONS)[number]["id"];

export function cubeDirection(direction: BlunderCubeAction): CubeDirection {
  if (direction === "double_accepted" || direction === "double_rejected") return "receive";
  return "offer";
}

/**
 * Every face a doubling cube can read: 1 while it is centred, then doubling to
 * 64. The Cube value filter's stops come from here rather than from the values
 * the data happens to hold, so they stay evenly spaced and a face nobody has
 * reached yet needs no new constant to appear — only a blunder that reaches it.
 */
export const CUBE_LADDER: readonly number[] = [1, 2, 4, 8, 16, 32, 64];

/**
 * The ladder up to `top`, which is the highest face the data reaches. Stopping
 * there keeps every stop on the track able to change the list, rather than
 * running out to 64 past four faces no blunder has played.
 *
 * Always at least two stops: a slider whose min equals its max has nothing to
 * drag, so a database holding only centred cubes still gets a usable control.
 */
export function cubeValueLadder(top: number): number[] {
  const reached = CUBE_LADDER.findIndex((face) => face >= top);
  const stops = reached === -1 ? CUBE_LADDER.length : reached + 1;
  return CUBE_LADDER.slice(0, Math.max(stops, 2));
}

/**
 * Which cube values the list is narrowed to, held as the bounds that actually
 * narrow it: a null end is no bound at all rather than a bound sitting on the
 * ladder's edge. That is what lets the range be read off a URL without knowing
 * where the data tops out — and it means `?cubeMin=2` still means "2 and up" on
 * the day the first cube reaches 8, instead of having silently meant "2 to 4".
 */
export interface CubeValueRange {
  min: number | null;
  max: number | null;
}

/** Nothing narrowed: every value, whatever the data turns out to hold. */
export const ANY_CUBE_VALUE: CubeValueRange = { min: null, max: null };

/**
 * What the Kind filter offers: checker plays, and cube decisions split by which
 * side of the cube you were on. Ticking several widens the list, so "Checker
 * plays" and "Offering the cube" is either one.
 */
export const KIND_FILTERS = [
  { id: "checker", label: "Checker plays" },
  ...CUBE_DIRECTIONS,
] as const;

export type KindFilter = (typeof KIND_FILTERS)[number]["id"];

/**
 * Which of those three a single decision is, so a row can name itself the way
 * the filter that would select it does. A blunder stored as `both` is one
 * decision of each kind, so this reads the decision's kind, not the row's.
 */
export function kindCategory(kind: BlunderKind, cubeAction: BlunderCubeAction): KindFilter {
  return kind === "checker" ? "checker" : cubeDirection(cubeAction);
}

/**
 * The same three worded for one decision rather than a set of them: the filter
 * offers "Checker plays" because ticking it widens the list, while a cell
 * describes the single blunder in front of you.
 */
export const KIND_LABELS: Record<KindFilter, string> = {
  checker: "Checker play",
  offer: "Offering the cube",
  receive: "Being offered the cube",
};

export const SORTS = [
  { id: "worst", label: "Worst first" },
  { id: "mildest", label: "Mildest first" },
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
] as const;

export type BlunderSort = (typeof SORTS)[number]["id"];

export const KIND_FILTER_IDS = KIND_FILTERS.map(({ id }) => id);
export const SEVERITIES = SEVERITY_BANDS.map(({ id }) => id);
export const SORT_IDS = SORTS.map(({ id }) => id);
export const CRAWFORD_IDS = CRAWFORD_STATE.map(({ id }) => id);
export const CRAWFORD_FILTER_IDS = CRAWFORD_FILTERS.map(({ id }) => id);

export const DEFAULT_SORT: BlunderSort = "worst";
export interface BlunderFilters {
  kinds: KindFilter[];
  severities: BlunderSeverity[];
  crawfords: CrawfordFilter[];
  cubeValue: CubeValueRange;
}

/** `?page=` is whatever was in the URL bar, so anything that isn't a page is page 1. */
export function pageFrom(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * `?sort=` is a single choice out of a whitelist, not a set, so unlike the
 * filters it has a default rather than an empty state: anything that isn't one
 * of ours — missing, misspelled, or repeated — is the default ordering.
 */
export function sortFrom(value: string | null): BlunderSort {
  return SORT_IDS.find((id) => id === value) ?? DEFAULT_SORT;
}

/**
 * One end of the cube value range. Only a real cube face counts, so anything
 * else — a 3, a word, an empty value — is no bound rather than a bound of its
 * own, the same way an unrecognised `?kind=` is dropped. A face the data has not
 * reached is still a face, and narrows the list to nothing rather than ignored.
 */
function cubeValueFrom(value: string | null): number | null {
  const face = Number(value);
  return CUBE_LADDER.includes(face) ? face : null;
}

/**
 * The cube value range, read from `?cubeMin=&cubeMax=`. Two params rather than
 * one because either end stands on its own: a floor with no ceiling is just
 * `?cubeMin=`, with no second half of a pair left conspicuously empty.
 */
function cubeValueRangeFrom(params: Pick<URLSearchParams, "get">): CubeValueRange {
  const min = cubeValueFrom(params.get("cubeMin"));
  const max = cubeValueFrom(params.get("cubeMax"));

  // Crossed bounds are two real faces in the wrong order, so they read as the
  // range between them — a typed-in URL gets the list it plainly meant rather
  // than the empty one a literal reading would give.
  if (min !== null && max !== null && min > max) return { min: max, max: min };
  return { min, max };
}

/**
 * The filters, read from `?kind=&severity=&crawford=&cubeMin=&cubeMax=`. Anything that
 * isn't one of ours is dropped, and each group comes back in the constants' own
 * order — which is what lets the browser and the server build the same cache key
 * from the same URL. Takes anything that can be read like search params, so the
 * read-only ones in the browser and a plain `URLSearchParams` on the server both fit.
 */
export function filtersFrom(params: Pick<URLSearchParams, "getAll" | "get">): BlunderFilters {
  const pick = <T extends string>(key: string, allowed: readonly T[]): T[] => {
    const chosen = new Set(params.getAll(key));
    return allowed.filter((value) => chosen.has(value));
  };

  return {
    kinds: pick("kind", KIND_FILTER_IDS),
    severities: pick("severity", SEVERITIES),
    crawfords: pick("crawford", CRAWFORD_FILTER_IDS),
    cubeValue: cubeValueRangeFrom(params),
  };
}

/**
 * Whether anything is narrowing the list, which is what tells an empty page
 * whether to blame the filters or the category. It names every member rather
 * than walking the object, so a filter that isn't a list of ticks — the cube
 * value range is the first — cannot quietly read as "nothing set".
 */
export function isFiltered({ kinds, severities, crawfords, cubeValue }: BlunderFilters): boolean {
  return (
    kinds.length > 0 ||
    severities.length > 0 ||
    crawfords.length > 0 ||
    cubeValue.min !== null ||
    cubeValue.max !== null
  );
}

/**
 * Everything a link has to carry to land on the view you are already looking at:
 * the filters, in the constants' own order, and the sort. It writes no `?page=`,
 * so a link built from it starts the list at the beginning.
 *
 * `sort` is a required argument rather than an optional one on purpose. Adding a
 * member to URL state should break every link that writes the URL until each one
 * has been told what to do about it — an optional parameter would instead let
 * every existing caller keep compiling while quietly clearing the sort.
 */
export function viewParams(
  { kinds, severities, crawfords, cubeValue }: BlunderFilters,
  sort: BlunderSort,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const kind of kinds) params.append("kind", kind);
  for (const severity of severities) params.append("severity", severity);
  for (const crawford of crawfords) params.append("crawford", crawford);
  if (cubeValue.min !== null) params.set("cubeMin", String(cubeValue.min));
  if (cubeValue.max !== null) params.set("cubeMax", String(cubeValue.max));
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  return params;
}

/** The blunder the URL has open: its id segment, and `?decision=` if there is one. */
interface OpenBlunder {
  id: string;
  decision: string | null;
}

/** The parts of a list row that decide where it links. */
interface BlunderRow {
  blunder_id: number;
  kind: BlunderKind;
  both: boolean;
}

/**
 * A blunder stored as `both` is two rows in the list under one id. Its checker
 * row keeps the plain address and its cube row adds `?decision=cube`. Every
 * other blunder is one row, and its id is enough.
 */
function isCubeHalf({ kind, both }: BlunderRow): boolean {
  return both && kind === "cube";
}

/** A row's link: the view in `query` comes along, plus `?decision=cube` if it needs one. */
export function blunderHref(category: string, row: BlunderRow, query: string): string {
  const params = new URLSearchParams(query);
  if (isCubeHalf(row)) params.set("decision", "cube");
  return `/${category}/${row.blunder_id}${params.size > 0 ? `?${params}` : ""}`;
}

/**
 * Whether a row is the one the URL has open. The id has to match, and on a `both`
 * blunder so does the half: `?decision=cube` is the cube row, and anything else
 * is the checker row. On every other blunder the param changes nothing, so a
 * stray one is ignored, like a stray `?sort=`.
 */
export function isOpen(row: BlunderRow, open: OpenBlunder): boolean {
  if (String(row.blunder_id) !== open.id) return false;
  return !row.both || isCubeHalf(row) === (open.decision === "cube");
}
