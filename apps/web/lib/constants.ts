import type { PaletteColor } from "@uiid/design-system";

export const SIDEBAR_MINWIDTH = 260;
export const SIDEBAR_MAXWIDTH = 480;

export const PER_PAGE = 15;
export const PAGE_SPREAD = 1;

export const NOTE_MAX_LENGTH = 2000;

/**
 * A category as a person reads it. The database stores them the way a column
 * does — `middle_game`, `one_man_back` — and the sidebar, the topbar and the
 * breadcrumb all draw the same name, so the one place it turns into prose is
 * here. Sentence case, like every other label in this file: "Checker plays", not
 * "Checker Plays".
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

/**
 * How few decisions a chart will draw from before it says so instead.
 *
 * Cube decisions are thin per category — `close_out` holds none at all,
 * `opening_game` holds one, and seven of the seventeen hold fewer than ten
 * before a filter is touched. A chart drawn from four decisions is a shape
 * without a subject, and the reader has no way to tell it from one drawn from
 * four hundred.
 *
 * Under this a chart keeps its place in the panel and names the count it has
 * rather than disappearing, so the panel's shape doesn't change as you move
 * between categories. One number for every chart: a threshold that varied by
 * chart would be a second thing to learn.
 */
export const MIN_CHART_DECISIONS = 10;

/**
 * How many matches one bar of the form panel covers.
 *
 * Matches rather than days, because a day is not a unit of play here: 64 of the
 * 155 days in the database hold one or two matches and seven hold eleven or
 * more. Dated points would put a Tuesday's single match beside a Saturday's
 * nineteen and weight them the same — 9 September reads 1.09 equity given up per
 * match and 10 September reads 0.10, and both are one match.
 *
 * Twenty-five because a 3-point match carries around two and a half mistakes, so
 * a block this wide is drawn from roughly sixty decisions — enough that a bar
 * moves when the play moves rather than when one bad game lands in it. Blocks
 * are consecutive and share no matches, so the two the panel compares are simply
 * the last bar and the one before it.
 */
export const FORM_WINDOW = 25;

/**
 * How many of a category's latest decisions the leaks card draws, one dot each.
 * Every category but `close_out` holds at least this many; a category that
 * holds fewer draws what it has.
 */
export const RECENT_DECISIONS = 10;

/**
 * Your best stretches — the floor of the scale, named rather than indexed off the
 * end of the array so `formBandsFor` has something to fall back to that is a band
 * and not `undefined`. Nothing sorts below it.
 */
const BEST = {
  id: "best",
  label: "among your best stretches",
  from: 0,
  color: "yellow",
  step: 400,
} as const;

/**
 * How a block of play reads against the rest of your record, warmest first.
 *
 * The severity bands cannot do this job, though they are the same idea. They
 * divide one error magnitude, and only one form measure is an error magnitude at
 * all: the cost of a mistake sits between 0.145 and 0.197 across every block,
 * which is `moderate` from end to end, so every bar would wear one colour.
 * Mistakes per match runs from 1.72 to 4.48 and would read as `catastrophic`
 * throughout while meaning nothing of the kind.
 *
 * `from` is a quantile of the blocks being drawn rather than a fixed quantity or
 * a ratio to their mean. A ratio was the first attempt and it wasted half the
 * strip: these measures trend, so the mean sits in the middle of the climb and
 * every early block lands under it — thirteen consecutive bars in one colour,
 * saying only "before the middle". Quantiles spend the colours on the spread
 * whatever shape the series has, so a bar always says where that stretch ranks
 * among the others beside it.
 *
 * Three bands rather than four, and no neutral among them. Neutral is what
 * `SEVERITY_COLOR` gives the mildest blunder, and it earns that there because a
 * single mild error nearly is nothing. A block is 25 matches and some sixty
 * mistakes, so there is no stretch of play here that amounts to nothing — a grey
 * bar would say one did, and half the strip was grey while saying it. Your best
 * stretches are yellow, which is the palette's way of saying "still a cost".
 *
 * Red takes the whole worse half rather than a quarter of it. Evenly cut
 * quartiles read as four ranks of equal standing, when what the panel is for is
 * spotting the bad runs: the half of your record that is worse than the other
 * half should look like the problem it is.
 *
 * Higher is worse on every form measure, since each counts something that went
 * wrong, so the bands run one way and no measure needs to say which direction is
 * good.
 *
 * The two warm bands reach to the 500 step rather than the 400 the rest of the
 * app draws charts at. Nothing here is labelled by a Status dot, so there is no
 * dot to match, and the 400 row's warm end is built to sit beside text: red is
 * `#ff6358` and orange is `#ffa15e`, a salmon and a peach that at bar width read
 * as one pale wash with no red in it. `#f9262a` against `#ff8918` is the same
 * two hues far enough apart to be counted.
 */
export const FORM_BANDS = [
  { id: "worst", label: "in your worse half", from: 0.5, color: "red", step: 500 },
  { id: "middling", label: "middling for you", from: 0.25, color: "orange", step: 500 },
  BEST,
] as const satisfies readonly {
  id: string;
  label: string;
  from: number;
  color: PaletteColor;
  step: number;
}[];

export type FormBand = (typeof FORM_BANDS)[number];

/**
 * Each block's band, indexed alongside the series it came from.
 *
 * The cut points are computed once for the whole series rather than per value,
 * because a quantile is a fact about the set and not about one member of it.
 *
 * A series with no spread — every block identical, which is what a brand new
 * database looks like — has no worst quarter to find, so all of it reads as the
 * best band rather than having three quarters of it arbitrarily reddened by ties.
 */
export function formBandsFor(series: readonly number[]): FormBand[] {
  if (series.length === 0) return [];
  if (Math.max(...series) === Math.min(...series)) return series.map(() => BEST);

  const sorted = [...series].sort((a, b) => a - b);
  const floors = FORM_BANDS.map((band) => ({
    band,
    floor: sorted[Math.min(sorted.length - 1, Math.floor(band.from * sorted.length))] ?? 0,
  }));

  return series.map((value) => floors.find(({ floor }) => value >= floor)?.band ?? BEST);
}

/**
 * The band thresholds as a track reads them: ascending, and without the bottom
 * band's floor of 0, which is the start of the track rather than a division in
 * it. Derived from `SEVERITY_BANDS` so a band that moves takes this with it.
 */
export const SEVERITY_THRESHOLDS = SEVERITY_BANDS.map(({ min }) => min)
  .filter((min) => min > 0)
  .sort((a, b) => a - b);

/**
 * Where the row-level track stops, and so the scale every row is drawn against.
 *
 * Fixed rather than fitted to the row: a bullet that sized itself to its own
 * value would put every row at the same length and compare nothing, which is
 * the one thing a column of them is for.
 *
 * 0.6 rather than the 1.369 the data actually reaches. Pinning the ceiling to
 * the worst decision ever made would squeeze the range nearly every row lives
 * in — 1,616 of 1,697 sit under 0.4 — into the first quarter of the track. This
 * gives the catastrophic band real width while pegging 21 decisions, 1.2% of
 * them, at the end. The badge beside it carries the exact number, so a pegged
 * row loses nothing but its last fraction of travel.
 */
export const ERROR_TRACK_MAX = 0.6;

/**
 * A hue as a value rather than a class. `palette-red` publishes the
 * `--palette-*` names a component's own CSS reads, which is no use to an SVG
 * fill handed in as a prop — so this names the token that class resolves to.
 *
 * The 400 step by default, because that is the one the palette classes land on:
 * a Status dot drawn `red` computes to `#ff6358`, which is `--color-red-400`.
 * Anything else would put a chart segment a shade away from the dot beside it.
 *
 * `step` is for the charts that have no dot to match. The 400 row is built to
 * sit beside text, so its warm end is pale — red is `#ff6358`, a salmon, and
 * orange is `#ffa15e`, a peach. Side by side at bar width those two read as one
 * colour, and neither reads as red. A chart whose hues have to be told apart
 * from each other rather than matched to a legend is better served lower down
 * the ramp; see `FORM_BANDS`.
 */
export function paletteVar(color: PaletteColor, step: number = 400): string {
  return `var(--color-${color}-${step})`;
}

/**
 * The ramp a ranked composition wears, hottest first.
 *
 * `--mc-cat-1` through `--mc-cat-6` is what the charts reach for unasked, and
 * six hues cycled across seventeen categories would give the biggest leak and
 * the seventh biggest the same colour — a legend that has to be read twice to
 * find out which one a segment means.
 *
 * So the hues carry rank instead of identity: the ramp runs from the darkest red
 * to the palest yellow, and because the segments are drawn in that order it says
 * the same thing their lengths do. It runs across three hues rather than down one
 * because thirteen steps of a single hue are thirteen shades of red, and the far
 * end of the bar would be a wash of them.
 */
const LEAK_RAMP = [
  ["red", 800],
  ["red", 700],
  ["red", 600],
  ["red", 500],
  ["orange", 700],
  ["orange", 600],
  ["orange", 500],
  ["orange", 400],
  ["yellow", 600],
  ["yellow", 500],
  ["yellow", 400],
  ["yellow", 300],
  ["yellow", 200],
] as const satisfies readonly (readonly [PaletteColor, number])[];

/**
 * `count` colours spread across the whole ramp, worst first.
 *
 * Spread rather than sliced, so the tail is always the pale end: a five-category
 * split taking the first five stops would be five reds and say nothing. Past
 * thirteen categories two neighbours can land on one stop — segments are drawn
 * with a gap between them, so the two still read as two.
 */
export function leakRamp(count: number): string[] {
  if (count <= 1) return LEAK_RAMP.slice(0, count).map(([color, step]) => paletteVar(color, step));

  return Array.from({ length: count }, (_, index) => {
    const [color, step] = LEAK_RAMP[Math.round((index * (LEAK_RAMP.length - 1)) / (count - 1))]!;
    return paletteVar(color, step);
  });
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
 * The four ways a cube decision goes wrong, which is every cube decision we
 * hold: each row in the database is already an error, so there is no correct
 * half to separate out and `cube_action` alone names which mistake was made.
 * That is why there is no "what the engine said" here — on a wrong decision it
 * is always the opposite of what was done.
 *
 * `tendency` is the reading that survives having only errors. Doubling when you
 * should wait and taking when you should pass are the same fault at two moments
 * — the cube is worth less to you than you think — and missing a double or
 * passing a live take are its mirror. Which of the two you pay more for is a
 * fact about how you play, and it needs no correct decisions to compute.
 *
 * Warm for aggressive and cool for passive, so a share bar reads as a
 * temperature before it is read as a legend.
 */
export const CUBE_ERRORS = [
  {
    id: "premature_double",
    label: "Doubled too early",
    action: "double_requested",
    side: "offer",
    tendency: "aggressive",
    color: "orange",
  },
  {
    id: "missed_double",
    label: "Missed double",
    action: "dice_rolled",
    side: "offer",
    tendency: "passive",
    color: "blue",
  },
  {
    id: "wrong_take",
    label: "Too aggressive, should've dropped it",
    action: "double_accepted",
    side: "receive",
    tendency: "aggressive",
    color: "red",
  },
  {
    id: "wrong_pass",
    label: "Too passive, should've accepted it",
    action: "double_rejected",
    side: "receive",
    tendency: "passive",
    color: "indigo",
  },
] as const satisfies readonly {
  id: string;
  label: string;
  action: (typeof CUBE_ACTION)[number];
  side: CubeDirection;
  tendency: string;
  color: PaletteColor;
}[];

export type CubeError = (typeof CUBE_ERRORS)[number]["id"];
export const CUBE_ERROR_IDS = CUBE_ERRORS.map(({ id }) => id);

/**
 * The heading each side of the cube gets, keyed by the direction the filters
 * already name so the two can never drift apart. The titles are the reader's
 * words for the moment rather than the filter's: a panel is about a decision
 * you made, where a filter is about a set you are asking for.
 */
export const CUBE_PANELS: Record<CubeDirection, { title: string; description: string }> = {
  offer: {
    title: "Doubling decisions",
    description:
      "Cubes you turned when you should have rolled, and cubes you left in the middle when you should have turned them.",
  },
  receive: {
    title: "Take/pass decisions",
    description:
      "Doubles you took that were droppers, and doubles you dropped that were worth playing on.",
  },
};

/** Which way a cube error leans, and what the share bar calls each side. */
export const CUBE_TENDENCIES = [
  { id: "aggressive", label: "too aggressive" },
  { id: "passive", label: "too passive" },
] as const;

export type CubeTendency = (typeof CUBE_TENDENCIES)[number]["id"];

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
  { id: "newest", label: "Newest" },
  { id: "worst", label: "Worst" },
  { id: "mildest", label: "Mildest" },
  { id: "oldest", label: "Oldest" },
] as const;

export type BlunderSort = (typeof SORTS)[number]["id"];

/**
 * The two halves of a category: the mistakes themselves, and what they add up
 * to. Both are narrowed by the same filters, so this picks which answer the
 * sidebar is narrowing rather than what is being asked of it.
 *
 * Spelled `?tab=` rather than `?view=` because a view here already means the
 * whole of what the URL is showing — the filters and the sort together, which
 * is what `viewParams` writes. This is one member of that, not another name
 * for it.
 */
export const CATEGORY_TABS = [
  { id: "blunders", label: "Blunders" },
  { id: "statistics", label: "Statistics" },
] as const;

export type CategoryTab = (typeof CATEGORY_TABS)[number]["id"];

export const KIND_FILTER_IDS = KIND_FILTERS.map(({ id }) => id);
export const SEVERITIES = SEVERITY_BANDS.map(({ id }) => id);
export const SORT_IDS = SORTS.map(({ id }) => id);
export const CATEGORY_TAB_IDS = CATEGORY_TABS.map(({ id }) => id);
export const CRAWFORD_IDS = CRAWFORD_STATE.map(({ id }) => id);
export const CRAWFORD_FILTER_IDS = CRAWFORD_FILTERS.map(({ id }) => id);
export const STANDING_FILTER_IDS = STANDING_FILTERS.map(({ id }) => id);

export const DEFAULT_SORT: BlunderSort = "newest";
export const DEFAULT_TAB: CategoryTab = "blunders";
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
 * `?tab=` is read the same way as `?sort=`, and for the same reason: a tab is
 * always showing, so anything that isn't one of ours is the half a category
 * opens on rather than no half at all.
 */
export function tabFrom(value: string | null): CategoryTab {
  return CATEGORY_TAB_IDS.find((id) => id === value) ?? DEFAULT_TAB;
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
 * the filters, in the constants' own order, the sort, and which half of the
 * category is showing. It writes no `?page=`, so a link built from it starts the
 * list at the beginning.
 *
 * `sort` and `tab` are required arguments rather than optional ones on purpose.
 * Adding a member to URL state should break every link that writes the URL until
 * each one has been told what to do about it — an optional parameter would
 * instead let every existing caller keep compiling while quietly clearing the
 * sort, or, for `tab`, putting a reader back on the blunders every time they
 * touched a filter.
 */
export function viewParams(
  { kinds, severities, crawfords, standings, minLead, dice, cubeValue }: BlunderFilters,
  sort: BlunderSort,
  tab: CategoryTab,
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
  if (tab !== DEFAULT_TAB) params.set("tab", tab);
  return params;
}

/**
 * A category's list, carrying the view the URL is already showing: the filters,
 * the sort and the tab always, and the page only when it is the category you are
 * in — a `?page=` belongs to the list it was counted for, not to one you have yet
 * to open. That exception is what makes this the way back out of a blunder: it
 * lands on the rows you left rather than the top of the list.
 *
 * The tab comes along because this is how you move between categories, and the
 * question you are asking survives that move: on the statistics for one category,
 * the next one opens on its statistics rather than dropping you back to its rows.
 * Out of a blunder it reads as nothing, since a row can only be clicked from the
 * blunders tab and its link writes no `?tab=`.
 */
export function categoryHref(
  category: string,
  params: Pick<URLSearchParams, "getAll" | "get">,
  { keepPage }: { keepPage: boolean },
): string {
  const query = viewParams(
    filtersFrom(params),
    sortFrom(params.get("sort")),
    tabFrom(params.get("tab")),
  );
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
