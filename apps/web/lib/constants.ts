import type { PaletteColor } from "@uiid/design-system";

export const PER_PAGE = 15;

export const SIDEBAR_MINWIDTH = 260;
export const SIDEBAR_MAXWIDTH = 480;

/** How many page numbers the paginator shows on each side of the current one. */
export const PAGE_SPREAD = 1;

export const NOTE_MAX_LENGTH = 2000;

/**
 * A category as a person reads it. The database stores them the way a column
 * does — `middle_game`, `one_man_back` — and the sidebar, the topbar and the
 * breadcrumb all draw the same name, so the one place it turns into prose is
 * here. Sentence case, like every other label in this file: "Worst first", not
 * "Worst First".
 */
export function categoryLabel(category: string): string {
  const words = category.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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
 * The two things you could have done with the cube, worded for the side of it
 * you were on. A cube blunder has no candidate plays to choose between — the
 * decision was the cube itself — so this is what its page offers instead.
 *
 * The ids are the engine's own words rather than the page's: `cube_decisions`
 * stores `doublers_best_action` as `double` or `roll` and
 * `receivers_best_action` as `take` or `pass`. A pick can be marked against the
 * answer already sitting on the position, with nothing in between to translate.
 *
 * Turning the cube comes first in both pairs, so the choices read down in the
 * same order whichever side of it you were on.
 */
export const CUBE_CHOICES: Record<CubeDirection, readonly { id: string; label: string }[]> = {
  offer: [
    { id: "double", label: "Offer double" },
    { id: "roll", label: "Roll instead" },
  ],
  receive: [
    { id: "take", label: "Accept double" },
    { id: "pass", label: "Drop cube" },
  ],
};

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
 * Every face a die reads. The Roll filter's two lists step through these, and a
 * `?die=` that names anything else is dropped.
 */
export const DIE_FACES: readonly number[] = [1, 2, 3, 4, 5, 6];

/**
 * Which roll the list is narrowed to, held as the faces themselves, higher
 * first — and as a set rather than a sequence, because a roll has no first die.
 * The scraper stores `die_1` and `die_2` in whatever order Galaxy sent them, and
 * that is no order at all: 591 rows hold the lower face first and 619 hold the
 * higher one. The table draws every one of them higher first, the way players
 * say a roll, so this matches a position either way round — `[6, 3]` finds all
 * 79 six-threes rather than the 44 that happen to be stored that way.
 *
 * No faces is no narrowing. One face is every roll containing it, so a 6 is 6-1
 * through 6-6. Two is that exact roll, and the same face twice is the double.
 */
export type DiceFilter = number[];

/**
 * What the Advantage filter offers: where the match stood when the blunder was
 * made, read from your side of it — see `matchScoreOf` for which side that is.
 *
 * Ahead, level, behind, which is the order a scoreboard runs through and the
 * order `isWinningText` already words them in. No descriptions under the names,
 * as Kind has none: a reader who knows what a match score is knows what these
 * three mean, and a line repeating the name would only push the counts apart.
 */
export const STANDING_FILTERS = [
  { id: "winning", label: "Winning" },
  { id: "tied", label: "Tied" },
  { id: "losing", label: "Losing" },
] as const;

export type StandingFilter = (typeof STANDING_FILTERS)[number]["id"];

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
export const STANDING_FILTER_IDS = STANDING_FILTERS.map(({ id }) => id);

export const DEFAULT_SORT: BlunderSort = "worst";
export interface BlunderFilters {
  kinds: KindFilter[];
  severities: BlunderSeverity[];
  crawfords: CrawfordFilter[];
  standings: StandingFilter[];
  /** The smallest lead, either way round, a row has to show. Null is no floor. */
  minLead: number | null;
  dice: DiceFilter;
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
 * The roll, read from `?die=`, higher first. Only a real face counts, so
 * anything else — a 7, a word, an empty value — is dropped rather than narrowing
 * the list to nothing, the same way an unrecognised `?kind=` is. A roll has two
 * dice, so a third `?die=` is dropped too and the two highest faces win.
 *
 * One param repeated rather than a `die1` and a `die2`, because the pair is a
 * set: appending twice and sorting here means a roll has one address, so the
 * browser and the server build the same cache key from it — the same reason the
 * ticked groups come back in the constants' order.
 */
function diceFrom(params: Pick<URLSearchParams, "getAll">): DiceFilter {
  return params
    .getAll("die")
    .map(Number)
    .filter((face) => DIE_FACES.includes(face))
    .sort((a, b) => b - a)
    .slice(0, 2);
}

/**
 * The floor on how far apart the scores were, read from `?lead=`. A lead is a
 * gap rather than a direction, so this counts either way round and it takes a
 * whole number of points from 1 up: 0 is every row there is, which is where
 * the field rests anyway, and anything else — a word, a minus, a half — is no
 * floor rather than a floor of its own.
 *
 * A lead longer than any match in the data is still a lead, and narrows the
 * list to nothing rather than being ignored, the way a cube face the data has
 * not reached does. That is what keeps a saved link honest: `?lead=4` asks the
 * same question on the day the first 5-point match lands as it did before.
 */
function minLeadFrom(value: string | null): number | null {
  const lead = Number(value);
  return Number.isInteger(lead) && lead >= 1 ? lead : null;
}

/**
 * The filters, read from
 * `?kind=&severity=&crawford=&standing=&lead=&die=&cubeMin=&cubeMax=`. Anything that
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
    standings: pick("standing", STANDING_FILTER_IDS),
    minLead: minLeadFrom(params.get("lead")),
    dice: diceFrom(params),
    cubeValue: cubeValueRangeFrom(params),
  };
}

/**
 * Whether anything is narrowing the list, which is what tells an empty page
 * whether to blame the filters or the category. It names every member rather
 * than walking the object, so a filter that isn't a list of ticks — the cube
 * value range is the first — cannot quietly read as "nothing set".
 */
export function isFiltered({
  kinds,
  severities,
  crawfords,
  standings,
  minLead,
  dice,
  cubeValue,
}: BlunderFilters): boolean {
  return (
    kinds.length > 0 ||
    severities.length > 0 ||
    crawfords.length > 0 ||
    standings.length > 0 ||
    minLead !== null ||
    dice.length > 0 ||
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
  { kinds, severities, crawfords, standings, minLead, dice, cubeValue }: BlunderFilters,
  sort: BlunderSort,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const kind of kinds) params.append("kind", kind);
  for (const severity of severities) params.append("severity", severity);
  for (const crawford of crawfords) params.append("crawford", crawford);
  for (const standing of standings) params.append("standing", standing);
  if (minLead !== null) params.set("lead", String(minLead));
  for (const die of dice) params.append("die", String(die));
  if (cubeValue.min !== null) params.set("cubeMin", String(cubeValue.min));
  if (cubeValue.max !== null) params.set("cubeMax", String(cubeValue.max));
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  return params;
}

/**
 * A category's list, carrying the view the URL is already showing: the filters
 * and the sort always, and the page only when it is the category you are in —
 * a `?page=` belongs to the list it was counted for, not to one you have yet to
 * open. That exception is what makes this the way back out of a blunder: it
 * lands on the rows you left rather than the top of the list.
 */
export function categoryHref(
  category: string,
  params: Pick<URLSearchParams, "getAll" | "get">,
  { keepPage }: { keepPage: boolean },
): string {
  const query = viewParams(filtersFrom(params), sortFrom(params.get("sort")));
  const page = pageFrom(params.get("page"));
  if (keepPage && page > 1) query.set("page", String(page));
  return `/${category}${query.size > 0 ? `?${query}` : ""}`;
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

/**
 * Which of a blunder's decisions its page is asking about, and so which set of
 * answers the page offers. Nearly every blunder holds one decision, and that is
 * the answer whatever the URL says.
 *
 * A blunder stored as `both` holds a checker decision and a cube one, and
 * `?decision=cube` — the param its cube row links with — picks the cube half.
 * It is read the same way here as `isOpen` reads it in the list, so the row you
 * clicked and the question you land on are the same decision.
 */
export function openDecision(
  decisions: readonly { kind: BlunderKind }[],
  decision: string | null,
): BlunderKind {
  const kinds = decisions.map(({ kind }) => kind);
  if (!kinds.includes("cube")) return "checker";
  return !kinds.includes("checker") || decision === "cube" ? "cube" : "checker";
}
