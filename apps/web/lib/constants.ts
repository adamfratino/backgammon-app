export const PER_PAGE = 20;

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
 * What the Kind filter offers: checker plays, and cube decisions split by which
 * side of the cube you were on. Ticking several widens the list, so "Checker
 * plays" and "Offering the cube" is either one.
 */
export const KIND_FILTERS = [
  { id: "checker", label: "Checker plays" },
  ...CUBE_DIRECTIONS,
] as const;

export type KindFilter = (typeof KIND_FILTERS)[number]["id"];

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

export const DEFAULT_SORT: BlunderSort = "worst";
export interface BlunderFilters {
  kinds: KindFilter[];
  severities: BlunderSeverity[];
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
 * The filters, read from `?kind=&severity=`. Anything that isn't one of ours is
 * dropped, and each group comes back in the constants' own order — which is
 * what lets the browser and the server build the same cache key from the same
 * URL. Takes anything with `getAll`, so the read-only search params in the
 * browser and a plain `URLSearchParams` on the server both fit.
 */
export function filtersFrom(params: Pick<URLSearchParams, "getAll">): BlunderFilters {
  const pick = <T extends string>(key: string, allowed: readonly T[]): T[] => {
    const chosen = new Set(params.getAll(key));
    return allowed.filter((value) => chosen.has(value));
  };

  return {
    kinds: pick("kind", KIND_FILTER_IDS),
    severities: pick("severity", SEVERITIES),
  };
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
  { kinds, severities }: BlunderFilters,
  sort: BlunderSort,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const kind of kinds) params.append("kind", kind);
  for (const severity of severities) params.append("severity", severity);
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
