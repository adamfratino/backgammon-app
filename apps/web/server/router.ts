import type { DatabaseSync } from "node:sqlite";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  ANY_CUBE_VALUE,
  type BlunderSort,
  CUBE_ACTION,
  CRAWFORD_FILTER_IDS,
  CRAWFORD_FILTERS,
  CRAWFORD_IDS,
  type CrawfordFilter,
  CUBE_ERROR_IDS,
  CUBE_ERRORS,
  cubeDirection,
  DEFAULT_SORT,
  FORM_WINDOW,
  KIND_FILTER_IDS,
  KIND_FILTERS,
  KINDS,
  type KindFilter,
  MATCH_SORT_IDS,
  type MatchSort,
  NOTE_MAX_LENGTH,
  PER_PAGE,
  RECENT_DECISIONS,
  RECENT_MATCHES,
  SEVERITIES,
  SEVERITY_BANDS,
  SORT_IDS,
  STANDING_FILTER_IDS,
  STANDING_FILTERS,
  type StandingFilter,
} from "@/lib/constants";
import { describeBoard } from "@/server/board";
import { publicProcedure, router } from "@/server/trpc";

/**
 * The shapes these procedures promise to return. `.output()` parses every
 * response against them at runtime, so a drifting query fails here with a clear
 * error instead of sending a wrong shape to the browser.
 */
const category = z.object({
  category: z.string(),
  /** How many of its blunders the filters leave; its total when none were asked for. */
  count: z.number(),
  /** How many it holds in all, which is what `count` is out of. */
  total: z.number(),
});

const syncStatus = z.object({
  runId: z.number().nullable(),
  state: z.enum(["idle", "checking", "scraping", "done", "error"]),
  category: z.string().nullable(),
  done: z.number(),
  total: z.number(),
  newBlunders: z.number(),
  error: z.string().nullable(),
  /** New blunders from every clean run after `since`, this one included. */
  newSince: z.number(),
});

const blunder = z.object({
  blunder_id: z.number(),
  kind: z.enum(KINDS),
  /** Stored as `both`, so this row is one of two in the list under the same id. */
  both: z.boolean(),
  /** Which side of the cube a `cube` decision was on, via `cubeDirection`. */
  cube_action: z.enum(CUBE_ACTION).nullable(),
  error_magnitude: z.number(),
  die_1: z.number().nullable(),
  die_2: z.number().nullable(),
  match_length: z.number().nullable(),
  score_black: z.number().nullable(),
  score_white: z.number().nullable(),
  cube_value: z.number().nullable(),
  /** The day its match finished, UTC, as `YYYY-MM-DD`. A blunder has no time of its own. */
  finished_on: z.string().nullable(),
  /**
   * The position itself, carried for the row's Copy button rather than for
   * anything the table draws — the one field here the reader never sees. It is
   * also the widest, ~51 characters a row, but a page is `PER_PAGE` rows: it put
   * 1,078 bytes on the category HTML and 323 of them over the wire, since XGIDs
   * are mostly dash runs and repeated `:0:0:1:` and so compress to a fraction of
   * what they measure.
   */
  source_xgid: z.string().nullable(),
});

/** Chances of each outcome from the mover's side. Gammons include backgammons. */
const probabilities = z.object({
  win: z.number().nullable(),
  win_gammon: z.number().nullable(),
  win_backgammon: z.number().nullable(),
  lose: z.number().nullable(),
  lose_gammon: z.number().nullable(),
  lose_backgammon: z.number().nullable(),
});

/** One legal play the engine considered. `rank` 1 is its choice. */
const candidate = probabilities.extend({
  rank: z.number(),
  notation: z.string().nullable(),
  equity: z.number().nullable(),
  /** Equity given up against rank 1, so 0 on the best play and negative below it. */
  equity_error: z.number().nullable(),
  move_played: z.boolean(),
});

/**
 * The three cube equities plus what each side should have done. Only a real
 * cube decision makes these interesting: on a checker blunder the position is
 * mid-roll, and `no_double` and `double_take` are frequently identical.
 */
const cubeDecision = z.object({
  no_double: z.number().nullable(),
  double_take: z.number().nullable(),
  double_pass: z.number().nullable(),
  optimal: z.number().nullable(),
  diff_no_double: z.number().nullable(),
  diff_double_take: z.number().nullable(),
  diff_double_pass: z.number().nullable(),
  doublers_best_action: z.string().nullable(),
  receivers_best_action: z.string().nullable(),
});

/** One side of the decoded checker layout, numbered from its own home board. */
const boardSide = z.object({
  bar: z.number(),
  off: z.number(),
  points: z.string(),
});

const boardPosition = z.object({
  onRoll: boardSide,
  opponent: boardSide,
});

/** One thing that went wrong in a position, and what it cost. */
const decision = z.object({
  kind: z.enum(KINDS),
  error_magnitude: z.number(),
});

/**
 * Everything needed to study one position. Deliberately separate from the list
 * shape above: folding candidates, cube equities and the board into
 * `byCategory` grows a 50-row page from ~15KB to ~96KB, all of which the page
 * dehydrates into the HTML to serve a row the reader may never open.
 */
const blunderDetail = probabilities.extend({
  blunder_id: z.number(),
  cube_action: z.enum(CUBE_ACTION).nullable(),
  color: z.string().nullable(),
  die_1: z.number().nullable(),
  die_2: z.number().nullable(),
  crawford_state: z.enum(CRAWFORD_IDS).nullable(),
  played_notation: z.string().nullable(),
  best_notation: z.string().nullable(),
  played_rank: z.number().nullable(),
  candidate_count: z.number(),
  match_length: z.number().nullable(),
  score_black: z.number().nullable(),
  score_white: z.number().nullable(),
  cube_value: z.number().nullable(),
  source_xgid: z.string().nullable(),
  decisions: z.array(decision),
  board: boardPosition.nullable(),
  candidates: z.array(candidate),
  cube: cubeDecision.nullable(),
});

/** A note on one blunder. `updated_at` is ISO 8601. */
const note = z.object({
  blunder_id: z.number(),
  body: z.string(),
  updated_at: z.string(),
});

export type Category = z.infer<typeof category>;
export type Blunder = z.infer<typeof blunder>;
type BlunderDetail = z.infer<typeof blunderDetail>;

/** Read straight from `blunders`; the board is derived from the position id. */
const DETAIL_COLUMNS = `
  b.blunder_id, b.cube_action, b.color, b.die_1, b.die_2, b.crawford_state,
  b.played_notation, b.best_notation, b.played_rank, b.candidate_count,
  b.match_length, b.score_black, b.score_white, b.cube_value, b.source_xgid,
  b.source_position_value, b.win, b.win_gammon, b.win_backgammon, b.lose,
  b.lose_gammon, b.lose_backgammon`;

/**
 * A blunder stored as `both` is two unrelated mistakes — a wrong cube, then a
 * wrong play — so it becomes one decision of each kind, each measured by its
 * own error. Every query that counts or lists starts from here.
 */
const WITH_DECISIONS = `
  WITH decisions AS (
    SELECT blunder_id, 'checker' AS kind, error_magnitude
    FROM blunders
    WHERE kind IN ('checker', 'both')
    UNION ALL
    SELECT blunder_id, 'cube', ABS(cube_raw_error)
    FROM blunders
    WHERE kind IN ('cube', 'both')
  )`;

/**
 * What each sort means in SQL. A keyword can't be bound like a value, so this is
 * the one place something from the URL picks SQL text — safe only because
 * `.input()` has already narrowed it to a key of this record. Typed by
 * `BlunderSort`, so a new entry in `SORTS` won't compile until it has one here.
 */
const SORT_ORDER_BY: Record<BlunderSort, string> = {
  worst: "d.error_magnitude DESC",
  mildest: "d.error_magnitude ASC",
  // Blunders from one match share its finish time, so within a match, worst first.
  newest: "m.finished_at DESC, d.error_magnitude DESC",
  oldest: "m.finished_at ASC, d.error_magnitude DESC",
};

/**
 * Magnitudes tie, and SQLite may return tied rows in a different order on each
 * query, so a tie across a page boundary can repeat one row and skip another.
 * `blunder_id` with `kind` is unique in `decisions`, which makes the order total.
 */
const TIE_BREAKER = "d.blunder_id ASC, d.kind ASC";

/**
 * What the list can be narrowed by. Declared apart from the procedure that lists
 * so the sidebar's counts and the filter panel's can ask for the same thing in
 * the same words.
 */
const blunderFilters = z.object({
  kinds: z.array(z.enum(KIND_FILTER_IDS)).default([]),
  severities: z.array(z.enum(SEVERITIES)).default([]),
  crawfords: z.array(z.enum(CRAWFORD_FILTER_IDS)).default([]),
  standings: z.array(z.enum(STANDING_FILTER_IDS)).default([]),
  // A whole number of points from 1 up, or no floor at all. A lead longer than
  // any match in the data is still a lead and narrows the list to nothing, the
  // way a cube face nobody has reached does — see `minLeadFrom`.
  minLead: z.number().int().min(1).nullable().default(null),
  // At most two faces, since a roll has two dice, and in no particular order —
  // see `DiceFilter`. `diceClause` sorts them itself rather than trusting the
  // caller to, so a request that sends them low face first still asks for the
  // roll it plainly meant.
  dice: z.array(z.number().int().min(1).max(6)).max(2).default([]),
  // Either end may be absent, which is no bound rather than a bound at the edge
  // of the cube's ladder — see `CubeValueRange`.
  cubeValue: z
    .object({
      min: z.number().int().positive().nullable(),
      max: z.number().int().positive().nullable(),
    })
    .default(ANY_CUBE_VALUE),
});

type BlunderFilters = z.infer<typeof blunderFilters>;

/**
 * A piece of SQL and the values its `?`s take, in that order. The two travel
 * together because composing clauses composes their values with them: join the
 * SQL one way and concatenate the values another, and every filter binds the
 * wrong thing.
 */
interface Clause {
  sql: string;
  params: (string | number)[];
}

/** All of them have to hold. Nothing to ask is `1`, which narrows nothing. */
function allOf(clauses: Clause[]): Clause {
  return {
    sql: clauses.length > 0 ? clauses.map(({ sql }) => sql).join(" AND ") : "1",
    params: clauses.flatMap(({ params }) => params),
  };
}

/** Any one of them is enough, and nothing to ask is no clause at all. */
function anyOf(clauses: Clause[]): Clause | null {
  if (clauses.length === 0) return null;

  return {
    sql: `(${clauses.map(({ sql }) => sql).join(" OR ")})`,
    params: clauses.flatMap(({ params }) => params),
  };
}

/** A cube decision's side of the cube is read off the action taken. */
function kindClause(kind: KindFilter): Clause {
  if (kind === "checker") return { sql: "d.kind = 'checker'", params: [] };

  const actions = CUBE_ACTION.filter((action) => cubeDirection(action) === kind);
  return {
    sql: `(d.kind = 'cube' AND b.cube_action IN (${actions.map(() => "?").join(", ")}))`,
    params: [...actions],
  };
}

/**
 * A band runs from its own `min` up to the next one above it, and the top band
 * has no ceiling.
 */
function severityClause(min: number): Clause {
  const above = SEVERITY_BANDS.filter((band) => band.min > min).at(-1);
  if (!above) return { sql: "d.error_magnitude >= ?", params: [min] };

  return { sql: "(d.error_magnitude >= ? AND d.error_magnitude < ?)", params: [min, above.min] };
}

/**
 * Derived from the position rather than read from `b.crawford_state`, which the
 * scraper left null on about one blunder in eight. See `crawfordFilterOf`.
 */
function crawfordClause(crawford: CrawfordFilter): Clause {
  return { sql: "crawford_filter(b.source_xgid) = ?", params: [crawford] };
}

/**
 * How far ahead you were when the blunder was made, in points — positive
 * winning, negative losing, zero tied. Written once and shared by both the
 * filters that read it, so the Advantage ticks and the Min. score field can
 * never disagree about what a lead is. See `leadOf` for which score is yours and how
 * the rows the scraper left without one are still answered.
 */
const SCORE_LEAD = "score_lead(b.score_black, b.score_white, b.source_xgid)";

/**
 * Where the match stood, as the sign of that lead. A row whose score is unknown
 * compares as null against all three, and so falls outside every tick rather
 * than riding along in each — the way an unknown cube value sits outside any
 * range. No row in the data is one: the XGID carries a score for all 1,675.
 */
function standingClause(standing: StandingFilter): Clause {
  const sign = standing === "winning" ? ">" : standing === "losing" ? "<" : "=";
  return { sql: `${SCORE_LEAD} ${sign} 0`, params: [] };
}

/**
 * How far apart the scores had to be, counted either way round: the field asks
 * about the size of a gap, and which side of it you were on is what the ticks
 * beside it are for. Asking for both is the pair read together — "losing by two
 * or more" — and asking for a floor with Tied ticked is a contradiction the
 * panel shows rather than hides, as a 0 on the Tied option.
 */
function minLeadClause(minLead: number | null): Clause | null {
  if (minLead === null) return null;
  return { sql: `ABS(${SCORE_LEAD}) >= ?`, params: [minLead] };
}

/**
 * The filters that are a list of options, which are the ones that can be counted
 * one option at a time. Cube value is a range instead, so it has no options to
 * count — but it still narrows every count here, like any group that isn't the
 * one being counted.
 */
const COUNTED_GROUPS = ["kinds", "severities", "crawfords", "standings"] as const;

type CountedGroup = (typeof COUNTED_GROUPS)[number];

/**
 * How many rows each option of each counted group would leave. Records over the
 * ids rather than free-form objects, so an option the SQL forgot to count fails
 * `.output()` here instead of arriving as a blank badge.
 */
const filterCounts = z.object({
  kinds: z.record(z.enum(KIND_FILTER_IDS), z.number()),
  severities: z.record(z.enum(SEVERITIES), z.number()),
  crawfords: z.record(z.enum(CRAWFORD_FILTER_IDS), z.number()),
  standings: z.record(z.enum(STANDING_FILTER_IDS), z.number()),
});

export type FilterCounts = z.infer<typeof filterCounts>;

/**
 * What one group of mistakes cost: how many decisions were in it, and the equity
 * they gave up between them. Both, because the two disagree — the moderate band
 * holds 901 of the database's 1,697 decisions and gives up 123.43 equity, where
 * the 81 catastrophic ones give up 45.28. A number drawn from either alone tells
 * the opposite story to the one drawn from the other.
 */
const errorTotals = z.object({
  decisions: z.number(),
  equityLost: z.number(),
});

/**
 * The category's decisions as the filters leave them, divided two ways: by how
 * bad each was, and — for the cube decisions among them — by which mistake it
 * was.
 *
 * `decisions` is the total the bands divide, and it is there to be named on
 * screen: the list shows one page of rows while these describe every decision
 * the filters leave, and without the denominator in front of you a panel
 * sitting under fifteen rows reads as a summary of those fifteen.
 *
 * Records over the ids rather than arrays, as `filterCounts` is, so a group the
 * SQL forgets to sum fails `.output()` here instead of arriving as a blank row.
 */
const blunderStats = z.object({
  decisions: z.number(),
  bands: z.record(z.enum(SEVERITIES), errorTotals),
  /**
   * The same totals for each way a cube decision goes wrong. Every cube decision
   * here is already an error, so these four divide them completely and their
   * counts sum to the cube decisions the filters leave — which is what the cube
   * panels use as their own denominator rather than asking for a fifth number.
   */
  cube: z.record(z.enum(CUBE_ERROR_IDS), errorTotals),
});

type BlunderStats = z.infer<typeof blunderStats>;

/**
 * One window of play, measured three ways.
 *
 * `lost` is the product of the other two — how often you go wrong, times what
 * going wrong costs — and all three are here because the product on its own
 * cannot say which half moved. Across this database they disagree completely:
 * `cost` has sat between 0.145 and 0.197 since February while `mistakes` ran
 * from 1.72 to 4.48, so the equity is going the same way it always did, just
 * more often.
 */
const formPoint = z.object({
  /** Decisions gone wrong per match. */
  mistakes: z.number(),
  /** Equity given up per mistake — what one of them costs when it happens. */
  cost: z.number(),
  /** Equity given up per match, which is `mistakes` × `cost`. */
  lost: z.number(),
});

export type FormPoint = z.infer<typeof formPoint>;

/**
 * How you have been playing, block by block rather than as one total.
 *
 * `points` is one point per `FORM_WINDOW` matches, oldest first, and the blocks
 * share no matches with each other. A rolling average was the other way to cut
 * this and it is the wrong shape for bars: consecutive rolling windows differ by
 * a single match, so drawing them as bars would put 646 of them side by side
 * each repeating 24/25ths of its neighbour. A bar is a quantity you can point
 * at, which means it has to stand on its own data.
 *
 * Blocks are counted back from the newest match, so the last one is always a
 * full window and it is the oldest matches — however many are left over — that
 * fall outside. That way the bar the panel reports is never a part-block, and it
 * does not change shape as the next match lands.
 *
 * `now` and `before` are the last two points, so the pair the panel compares is
 * the pair the chart ends on. Reading them off the series rather than summing
 * them again separately is what stops the headline figure from disagreeing with
 * the bars underneath it.
 */
const form = z.object({
  /** How many matches one point covers, so the panel can name its own window. */
  window: z.number(),
  /** Every match with a finish time, which is what the blocks are cut from. */
  matches: z.number(),
  points: z.array(formPoint),
  /** The newest full block, or null when there are not yet `window` matches. */
  now: formPoint.nullable(),
  /** The block before that one, or null when there is not yet a second. */
  before: formPoint.nullable(),
});

type Form = z.infer<typeof form>;

/**
 * Your ER match by match across the form panel's latest block, so the bars are
 * the same matches its `now` figure averages.
 *
 * `now` and `before` are plain means of each match's ER, not Galaxy's
 * decision-weighted figure: only the rate is kept, not the decisions behind it.
 */
const erTrend = z.object({
  /** How many matches the bars cover, and how many `before` averages. */
  window: z.number(),
  /** Your ER in each of the last `window` matches, oldest first. Null where it wasn't kept. */
  series: z.array(z.number().nullable()),
  /** The mean of `series`, or null when none of it has an ER. */
  now: z.number().nullable(),
  /** The mean over the `window` matches before those, or null until there are that many. */
  before: z.number().nullable(),
});

type ErTrend = z.infer<typeof erTrend>;

function meanOf(values: (number | null)[]): number | null {
  const known = values.filter((value) => value !== null);
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0) / known.length;
}

/**
 * What one category has cost across every match, ranked against the others.
 *
 * `equityLost` is the ranking figure rather than `decisions`, because the two
 * put different categories on top and only one of them is what a match is lost
 * by. Ranking on `perDecision` was the third option and is the one to avoid:
 * the whole spread is 0.130 to 0.233, and the top of it is `deep_anchor_game`
 * off twenty decisions — a rank built from noise. Sorting by the total makes
 * that problem disappear rather than needing a minimum to guard it, since a
 * category with too few decisions to trust cannot reach the top on a sum.
 */
const leak = z.object({
  category: z.string(),
  /** Its share of every decision — `perDecision` is `equityLost` over this. */
  decisions: z.number(),
  equityLost: z.number(),
  /** What one mistake here costs on average. The column the ranking is not. */
  perDecision: z.number(),
  /** The first `RECENT_DECISIONS` error magnitudes the Newest sort lists. */
  recent: z.array(z.number()),
});

export type Leak = z.infer<typeof leak>;

/**
 * A list row cut down to what a match's blunder line draws, links with and
 * opens a quick view on, plus the category the link needs — a list row never
 * carries one, because its table is already inside the category.
 */
const matchBlunder = blunder
  .pick({
    blunder_id: true,
    kind: true,
    both: true,
    cube_action: true,
    error_magnitude: true,
    score_black: true,
    score_white: true,
    source_xgid: true,
  })
  .extend({ category: z.string() });

/** One match and every decision you got wrong in it, in the order you made them. */
const match = z.object({
  match_id: z.number(),
  /** The day it finished, UTC, as `YYYY-MM-DD` — the same day the table prints. */
  finished_on: z.string(),
  /** The final score, your points first, as `MatchScore` reads a running one. */
  yours: z.number().nullable(),
  theirs: z.number().nullable(),
  /**
   * Your ER as Galaxy measures it, over every decision in the match rather than
   * only the ones listed here. Null on a match whose page had already left the
   * scraper's `raw/` when ER started being kept, so `load` could not reach it.
   */
  your_er: z.number().nullable(),
  blunders: z.array(matchBlunder),
});

export type MatchBlunder = z.infer<typeof matchBlunder>;
export type Match = z.infer<typeof match>;

interface FilterOption {
  group: CountedGroup;
  id: string;
  /** What ticking this one option, and nothing else in its group, asks for. */
  clause: Clause;
}

/**
 * Every option of every counted group, in the order the panel lists them. A
 * group's clause is the OR of the options ticked in it, so these same
 * definitions narrow the list and count the badges — one place where an option
 * says what it means.
 */
const FILTER_OPTIONS: FilterOption[] = [
  ...KIND_FILTERS.map(({ id }) => ({ group: "kinds" as const, id, clause: kindClause(id) })),
  ...SEVERITY_BANDS.map(({ id, min }) => ({
    group: "severities" as const,
    id,
    clause: severityClause(min),
  })),
  ...CRAWFORD_FILTERS.map(({ id }) => ({
    group: "crawfords" as const,
    id,
    clause: crawfordClause(id),
  })),
  ...STANDING_FILTERS.map(({ id }) => ({
    group: "standings" as const,
    id,
    clause: standingClause(id),
  })),
];

/** The options one group has ticked, which widen it rather than narrow it. */
function groupClause(group: CountedGroup, ticked: readonly string[]): Clause | null {
  const ticks = FILTER_OPTIONS.filter(
    (option) => option.group === group && ticked.includes(option.id),
  );

  return anyOf(ticks.map(({ clause }) => clause));
}

/**
 * Each end is its own clause, so a floor with no ceiling asks only what it
 * means. A row whose cube value is unknown is outside any range that was asked
 * for, and drops out of a narrowed list rather than riding along.
 */
function cubeValueClause({ min, max }: BlunderFilters["cubeValue"]): Clause | null {
  const ends: Clause[] = [];
  if (min !== null) ends.push({ sql: "b.cube_value >= ?", params: [min] });
  if (max !== null) ends.push({ sql: "b.cube_value <= ?", params: [max] });

  return ends.length > 0 ? allOf(ends) : null;
}

/**
 * The roll, matched as a set of faces rather than against the two columns in
 * order: `die_1` and `die_2` hold whichever face Galaxy sent first, so `MAX` and
 * `MIN` put them in the order the faces are already in — higher first, the order
 * the table's Roll column draws them — before anything is compared. A double
 * falls out of the same pair of equalities rather than needing a case of its own.
 *
 * Only a checker decision has a roll. The Roll column draws dice for those and a
 * dash for every cube decision, so a cube row cannot match a roll the reader can
 * see — even though 139 of them carry the dice of the roll that followed the cube
 * being left in the middle. Picking a die drops them, the way a cube value range
 * drops a row whose value is unknown.
 */
function diceClause(dice: number[]): Clause | null {
  const [high, low] = [...dice].sort((a, b) => b - a);
  if (high === undefined) return null;

  const isChecker: Clause = { sql: "d.kind = 'checker'", params: [] };

  // One face is every roll containing it, so either column may be the one holding
  // it. Two faces name the roll exactly, whichever column each of them is in.
  if (low === undefined) {
    return allOf([isChecker, { sql: "(b.die_1 = ? OR b.die_2 = ?)", params: [high, high] }]);
  }

  return allOf([
    isChecker,
    { sql: "MAX(b.die_1, b.die_2) = ?", params: [high] },
    { sql: "MIN(b.die_1, b.die_2) = ?", params: [low] },
  ]);
}

/**
 * The pair of columns every statistic is made of: how many decisions matched,
 * and what they cost between them. `name` is this file's own constant rather
 * than anything a request sent, which is what makes it safe to name a column
 * with; the clause's own values are still bound.
 */
function totalsFor(name: string, match: Clause): Clause[] {
  return [
    {
      sql: `SUM(CASE WHEN ${match.sql} THEN 1 ELSE 0 END) AS ${name}_decisions`,
      params: match.params,
    },
    {
      sql: `SUM(CASE WHEN ${match.sql} THEN d.error_magnitude ELSE 0 END) AS ${name}_equity`,
      params: match.params,
    },
  ];
}

/**
 * The filters as SQL: one clause per group that was set, each carrying the
 * values it binds. Every value is bound, so nothing from the URL is ever part of
 * the SQL itself.
 *
 * The page of rows, the sidebar's counts and the panel's counts all come through
 * here. A count that read the filters its own way would eventually disagree with
 * the page it is counting, and what the reader would see is a sidebar that lies.
 *
 * `without` leaves one group out, which is what lets an option be counted: a
 * badge has to read what picking that option gives, not what it adds to what is
 * already ticked beside it.
 */
function filterClauses(filters: BlunderFilters, without?: CountedGroup): Clause[] {
  const groups = COUNTED_GROUPS.filter((group) => group !== without).map((group) =>
    groupClause(group, filters[group]),
  );

  return [
    ...groups,
    minLeadClause(filters.minLead),
    diceClause(filters.dice),
    cubeValueClause(filters.cubeValue),
  ].filter((clause) => clause !== null);
}

/**
 * What each match sort means in SQL, picked by key the way `SORT_ORDER_BY` is.
 * A match loaded without an ER has nothing to rank by, so it waits at the end of
 * Worst and Best alike rather than passing for either. Every order ends on the
 * id, so two matches finishing in the same instant still land one fixed way.
 */
const MATCH_ORDER_BY: Record<MatchSort, string> = {
  newest: "m.finished_at DESC, m.match_id DESC",
  oldest: "m.finished_at ASC, m.match_id ASC",
  worst: "m.self_error_rate DESC NULLS LAST, m.finished_at DESC, m.match_id DESC",
  best: "m.self_error_rate ASC NULLS LAST, m.finished_at DESC, m.match_id DESC",
};

/**
 * The matches a list holds: every finished one with at least one decision the
 * filters keep. With nothing asked for that is every match, since the scraper
 * only builds a match's row out of its blunders.
 */
function listedMatches(filter: Clause): Clause {
  return {
    sql: `m.finished_at IS NOT NULL AND m.match_id IN (
            SELECT b.match_id
            FROM decisions d
            JOIN blunders b ON b.blunder_id = d.blunder_id
            WHERE ${filter.sql}
          )`,
    params: filter.params,
  };
}

/**
 * One page of matches, each carrying only the decisions the filters keep — so a
 * match listed under Catastrophic shows its catastrophic lines and no others.
 * Its ER stays the whole match's: that is Galaxy's figure, not a sum of these.
 */
function matchesOf(
  db: DatabaseSync,
  filter: Clause,
  { sort, limit, offset }: { sort: MatchSort; limit: number; offset: number },
): Match[] {
  const listed = listedMatches(filter);

  const matches = db
    .prepare(
      `${WITH_DECISIONS}
       SELECT m.match_id, date(m.finished_at) AS finished_on, m.self_score AS yours,
              m.opponent_score AS theirs, m.self_error_rate AS your_er
       FROM matches m
       WHERE ${listed.sql}
       ORDER BY ${MATCH_ORDER_BY[sort]}
       LIMIT ? OFFSET ?`,
    )
    .all(...listed.params, limit, offset) as unknown as Omit<Match, "blunders">[];

  // In the order you made them, which splitting by match below keeps. Ids
  // run through a match in play order: taken that way, the points scored
  // never fall between one blunder and the next across 992 pairs, and within
  // a game the pips left on the board fall in 447 of 492 — the rest are
  // hits. `cube` sorts after `checker`, so descending puts a `both`
  // blunder's cube first, which is where it came: before the dice were thrown.
  const rows = db
    .prepare(
      `${WITH_DECISIONS}
       SELECT b.match_id, d.blunder_id, d.kind, b.kind = 'both' AS both, b.cube_action,
              d.error_magnitude, b.score_black, b.score_white, b.source_xgid, bc.category
       FROM decisions d
       JOIN blunders b ON b.blunder_id = d.blunder_id
       JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
       WHERE b.match_id IN (SELECT value FROM json_each(?)) AND ${filter.sql}
       ORDER BY d.blunder_id ASC, d.kind DESC`,
    )
    .all(
      JSON.stringify(matches.map(({ match_id }) => match_id)),
      ...filter.params,
    ) as unknown as (Omit<MatchBlunder, "both"> & { match_id: number; both: number })[];

  // `.output()` strips `match_id` off each blunder once it has done its job here.
  return matches.map((match) => ({
    ...match,
    blunders: rows
      .filter((row) => row.match_id === match.match_id)
      .map((row) => ({ ...row, both: row.both === 1 })),
  }));
}

/**
 * What each option of each counted group would leave, as badges on the panel:
 * one number per option, all of them out of one pass over the rows in `scope`.
 * `tally` says what a number counts — decisions for a category's list, matches
 * for the matches page — given the condition a row has to meet to be counted.
 *
 * Every group is counted with its own ticks left out and every other group's
 * kept, so an option reads as what picking it gives rather than what it adds
 * to what is already picked beside it. In `blitz` under Severity =
 * Catastrophic the three Kind options divide that band between them — 13, 0
 * and 10 — where counted the other way, ticking Checker plays would leave
 * the other two reading 13 and 23 and none of the three meaning anything.
 */
function optionCounts(
  db: DatabaseSync,
  filters: BlunderFilters,
  scope: Clause,
  tally: (condition: string) => string,
): FilterCounts {
  // What the rest of the panel narrows to — once per group, rather than
  // once per option, since every option in a group is counted under it.
  //
  // Typed by `CountedGroup` rather than left to infer, so a group added to
  // `COUNTED_GROUPS` fails to compile here until it has been told what the
  // rest of the panel means for it — the way `viewParams` breaks every
  // caller that writes the URL rather than quietly dropping one.
  const rest: Record<CountedGroup, Clause> = {
    kinds: allOf(filterClauses(filters, "kinds")),
    severities: allOf(filterClauses(filters, "severities")),
    crawfords: allOf(filterClauses(filters, "crawfords")),
    standings: allOf(filterClauses(filters, "standings")),
  };

  // One column per option. `group` and `id` are this file's own constants
  // rather than anything a request sent, which is what makes them safe to
  // name a column with; every value is still bound.
  const columns = FILTER_OPTIONS.map(({ group, id, clause }) => ({
    sql: `${tally(`${rest[group].sql} AND ${clause.sql}`)} AS ${group}_${id}`,
    params: [...rest[group].params, ...clause.params],
  }));

  // The columns bind before the scope does: a SELECT list is read before the
  // WHERE that follows it.
  const bound = [...columns.flatMap((column) => column.params), ...scope.params];

  const row = db
    .prepare(
      `${WITH_DECISIONS}
       SELECT ${columns.map(({ sql }) => sql).join(", ")}
       FROM decisions d
       JOIN blunders b ON b.blunder_id = d.blunder_id
       JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
       LEFT JOIN matches m ON m.match_id = b.match_id
       WHERE ${scope.sql}`,
    )
    .get(...bound) as Record<string, number | null>;

  // A scope holding no rows at all sums to null rather than to zero,
  // which is every count on a category that doesn't exist.
  const counts = (group: CountedGroup) =>
    Object.fromEntries(
      FILTER_OPTIONS.filter((option) => option.group === group).map(({ id }) => [
        id,
        row[`${group}_${id}`] ?? 0,
      ]),
    );

  // Safe only because `.output()` re-checks the real shape at runtime, and
  // its records name every option: a group that lost one fails there.
  return {
    kinds: counts("kinds"),
    severities: counts("severities"),
    crawfords: counts("crawfords"),
    standings: counts("standings"),
  } as FilterCounts;
}

export const appRouter = router({
  categories: router({
    /**
     * Drives the sidebar: what each category holds, and how much of that the
     * filters leave. Both numbers come out of one pass, so the sidebar costs one
     * query however many categories there are.
     *
     * Ordered by the total rather than by the count, so ticking a filter changes
     * the numbers without moving the categories out from under the pointer.
     */
    list: publicProcedure
      .input(blunderFilters)
      .output(z.array(category))
      .query(({ ctx, input }) => {
        // Nothing asked for narrows nothing, so every row counts towards both.
        const { sql, params } = allOf(filterClauses(input));

        const rows = ctx.db
          .prepare(
            `${WITH_DECISIONS}
             SELECT bc.category, COUNT(*) AS total,
                    SUM(CASE WHEN ${sql} THEN 1 ELSE 0 END) AS count
             FROM decisions d
             JOIN blunders b ON b.blunder_id = d.blunder_id
             JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
             GROUP BY bc.category
             ORDER BY total DESC, bc.category ASC`,
          )
          .all(...params);

        return rows as unknown as Category[];
      }),
  }),

  /**
   * Every match at once, which is the one question a category cannot be asked.
   * These take no filters: the sidebar narrows a category, and there is nothing
   * on the home page for it to narrow — the answer there is the whole record.
   */
  overall: router({
    /**
     * The form bars: how you have played across the database, a block at a time.
     *
     * Cut in SQL rather than over rows in JS because the cut is the query — one
     * pass over every match joined to its decisions, numbered newest first and
     * grouped by which block of `FORM_WINDOW` it falls in. `HAVING` is what drops
     * the leftover oldest matches, so a short block can never be drawn beside
     * full ones as though it measured the same thing.
     */
    form: publicProcedure.output(form).query(({ ctx }) => {
      const points = ctx.db
        .prepare(
          `${WITH_DECISIONS}
           , per_match AS (
             SELECT m.match_id,
                    m.finished_at,
                    COUNT(d.blunder_id) AS mistakes,
                    COALESCE(SUM(d.error_magnitude), 0) AS lost
             FROM matches m
             LEFT JOIN blunders b ON b.match_id = m.match_id
             LEFT JOIN decisions d ON d.blunder_id = b.blunder_id
             WHERE m.finished_at IS NOT NULL
             GROUP BY m.match_id
           ),
           numbered AS (
             SELECT mistakes,
                    lost,
                    -- Newest first, so block 0 is the most recent full window and
                    -- any remainder falls off the old end. The id breaks ties, so
                    -- two matches finishing in the same instant still land in one
                    -- fixed order. Cast because a bound parameter arrives as a
                    -- float, and dividing by a float is float division rather
                    -- than integer division — without the cast every match lands
                    -- in a block of its own.
                    (ROW_NUMBER() OVER (ORDER BY finished_at DESC, match_id DESC) - 1)
                      / CAST(? AS INTEGER) AS block
             FROM per_match
           )
           SELECT AVG(mistakes) AS mistakes,
                  AVG(lost) AS lost,
                  -- The block's equity over the block's mistakes, not the average
                  -- of each match's own ratio: a match with no mistakes has no
                  -- cost to average in, and one with a single catastrophe would
                  -- otherwise weigh as much as one with six small errors.
                  SUM(lost) / NULLIF(SUM(mistakes), 0) AS cost
           FROM numbered
           GROUP BY block
           HAVING COUNT(*) = CAST(? AS INTEGER)
           ORDER BY block DESC`,
        )
        .all(FORM_WINDOW, FORM_WINDOW) as unknown as (Omit<FormPoint, "cost"> & {
        cost: number | null;
      })[];

      const { matches } = ctx.db
        .prepare("SELECT COUNT(*) AS matches FROM matches WHERE finished_at IS NOT NULL")
        .get() as { matches: number };

      // A block with no mistakes in it divides by nothing, so `cost` comes back
      // null. It is a real answer — nothing went wrong — and the only honest
      // number for it is zero, which is also what `mistakes` and `lost` read.
      const costed = points.map((point) => ({ ...point, cost: point.cost ?? 0 }));

      return {
        window: FORM_WINDOW,
        matches,
        points: costed,
        now: costed.at(-1) ?? null,
        before: costed.at(-2) ?? null,
      } satisfies Form;
    }),

    /** The ER bars: the latest window of matches, oldest first, and the window before it for the footer. */
    er: publicProcedure.output(erTrend).query(({ ctx }) => {
      const ers = (
        ctx.db
          .prepare(
            `SELECT self_error_rate AS er
             FROM matches
             WHERE finished_at IS NOT NULL
             ORDER BY finished_at DESC, match_id DESC
             LIMIT ?`,
          )
          .all(FORM_WINDOW * 2) as { er: number | null }[]
      ).map(({ er }) => er);

      const latest = ers.slice(0, FORM_WINDOW);
      const previous = ers.slice(FORM_WINDOW);

      return {
        window: FORM_WINDOW,
        series: latest.toReversed(),
        now: meanOf(latest),
        before: previous.length === FORM_WINDOW ? meanOf(previous) : null,
      } satisfies ErTrend;
    }),

    /**
     * What each category has cost across every match, worst total first.
     *
     * Unfiltered and uncapped: seventeen rows is a table, and cutting it at the
     * top few would hide the tail the same way rolling it into an "Other"
     * segment would. The row that makes the table worth reading is in the
     * middle of it — `blitz` has 110 fewer decisions than `middle_game` and
     * gives up 67.7 against its 78.0, because each one costs more.
     */
    leaks: publicProcedure.output(z.array(leak)).query(({ ctx }) => {
      const rows = ctx.db
        .prepare(
          `${WITH_DECISIONS}
           , aged AS (
             SELECT bc.category,
                    d.error_magnitude,
                    -- The list's own Newest order, so the strip is that sort's
                    -- first rows in the order it shows them.
                    ROW_NUMBER() OVER (
                      PARTITION BY bc.category
                      ORDER BY ${SORT_ORDER_BY.newest}, ${TIE_BREAKER}
                    ) AS age
             FROM decisions d
             JOIN blunders b ON b.blunder_id = d.blunder_id
             JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
             LEFT JOIN matches m ON m.match_id = b.match_id
           )
           SELECT category,
                  COUNT(*) AS decisions,
                  SUM(error_magnitude) AS equityLost,
                  AVG(error_magnitude) AS perDecision,
                  json_group_array(error_magnitude ORDER BY age)
                    FILTER (WHERE age <= ?) AS recent
           FROM aged
           GROUP BY category
           ORDER BY equityLost DESC, category ASC`,
        )
        .all(RECENT_DECISIONS) as unknown as (Omit<Leak, "recent"> & { recent: string })[];

      return rows.map((row) => ({ ...row, recent: JSON.parse(row.recent) as number[] }));
    }),

    /**
     * Your newest matches, newest first, each with its blunders.
     *
     * Newest as far as the database knows: the scraper builds a match's row out
     * of its blunders, so a match played without one never gets a row and cannot
     * be among these.
     */
    recentMatches: publicProcedure
      .output(z.array(match))
      .query(({ ctx }) =>
        matchesOf(ctx.db, allOf([]), { sort: DEFAULT_SORT, limit: RECENT_MATCHES, offset: 0 }),
      ),
  }),

  matches: router({
    /**
     * One page of the matches page, and how many matches the filters leave in
     * all. The filters are the list's own, read through `filterClauses`, so a
     * match is listed for the same decisions a category would list.
     */
    list: publicProcedure
      .input(
        blunderFilters.extend({
          page: z.number().int().min(1).default(1),
          sort: z.enum(MATCH_SORT_IDS).default(DEFAULT_SORT),
        }),
      )
      .output(z.object({ matches: z.array(match), total: z.number() }))
      .query(({ ctx, input }) => {
        const filter = allOf(filterClauses(input));
        const listed = listedMatches(filter);

        const { total } = ctx.db
          .prepare(`${WITH_DECISIONS} SELECT COUNT(*) AS total FROM matches m WHERE ${listed.sql}`)
          .get(...listed.params) as { total: number };

        return {
          matches: matchesOf(ctx.db, filter, {
            sort: input.sort,
            limit: PER_PAGE,
            offset: (input.page - 1) * PER_PAGE,
          }),
          total,
        };
      }),

    /**
     * The panel's badges on the matches page. Each counts matches rather than
     * decisions, because matches are what the page lists: a badge reads how
     * many would be left if you ticked it.
     */
    filterCounts: publicProcedure
      .input(blunderFilters)
      .output(filterCounts)
      .query(({ ctx, input }) =>
        optionCounts(
          ctx.db,
          input,
          { sql: "m.finished_at IS NOT NULL", params: [] },
          (condition) => `COUNT(DISTINCT CASE WHEN ${condition} THEN m.match_id END)`,
        ),
      ),
  }),

  blunders: router({
    byCategory: publicProcedure
      .input(
        blunderFilters.extend({
          category: z.string(),
          page: z.number().int().min(1).default(1),
          sort: z.enum(SORT_IDS).default(DEFAULT_SORT),
        }),
      )
      .output(
        z.object({
          blunders: z.array(blunder),
          total: z.number(),
        }),
      )
      .query(({ ctx, input }) => {
        // The category is this procedure's own; the rest of the narrowing is the
        // same narrowing the sidebar and the filter panel count under.
        const { sql: filter, params } = allOf([
          { sql: "bc.category = ?", params: [input.category] },
          ...filterClauses(input),
        ]);

        const rows = ctx.db
          .prepare(
            `${WITH_DECISIONS}
             SELECT d.blunder_id, d.kind, b.kind = 'both' AS both, d.error_magnitude,
                    b.cube_action, b.die_1, b.die_2, b.match_length, b.score_black,
                    b.score_white, b.cube_value, date(m.finished_at) AS finished_on,
                    b.source_xgid
             FROM decisions d
             JOIN blunders b ON b.blunder_id = d.blunder_id
             JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
             LEFT JOIN matches m ON m.match_id = b.match_id
             WHERE ${filter}
             ORDER BY ${SORT_ORDER_BY[input.sort]}, ${TIE_BREAKER}
             LIMIT ? OFFSET ?`,
          )
          .all(...params, PER_PAGE, (input.page - 1) * PER_PAGE);

        const { total } = ctx.db
          .prepare(
            `${WITH_DECISIONS}
             SELECT COUNT(*) AS total
             FROM decisions d
             JOIN blunders b ON b.blunder_id = d.blunder_id
             JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
             WHERE ${filter}`,
          )
          .get(...params) as { total: number };

        // The driver hands back untyped rows. These assertions are safe only
        // because `.output()` re-checks the real shape at runtime.
        // SQLite has no boolean type; `b.kind = 'both'` comes back as 0 or 1.
        return {
          blunders: rows.map((row) => ({ ...row, both: row.both === 1 })) as unknown as Blunder[],
          total,
        };
      }),

    /**
     * What each option in the panel would leave in this category, counted in
     * decisions — the rows the category lists. See `optionCounts`.
     */
    filterCounts: publicProcedure
      .input(blunderFilters.extend({ category: z.string() }))
      .output(filterCounts)
      .query(({ ctx, input }) =>
        optionCounts(
          ctx.db,
          input,
          { sql: "bc.category = ?", params: [input.category] },
          (condition) => `SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END)`,
        ),
      ),

    /**
     * What this category's decisions cost, banded by severity — the numbers
     * behind the stats panel under the table.
     *
     * Narrowed by `filterClauses`, the same helper behind the list, the
     * sidebar's counts and the panel's. A statistic that read the filters its
     * own way would eventually disagree with the table it sits under, and what
     * the reader would see is a panel that lies.
     *
     * Counts and equity together, in one pass, because the two disagree and
     * that disagreement is what the panel is for. `severityClause` draws the
     * band bounds rather than a CASE written here, so a band that moves takes
     * the filter, its badge and these totals with it.
     */
    stats: publicProcedure
      .input(blunderFilters.extend({ category: z.string() }))
      .output(blunderStats)
      .query(({ ctx, input }) => {
        const { sql: filter, params: filterParams } = allOf([
          { sql: "bc.category = ?", params: [input.category] },
          ...filterClauses(input),
        ]);

        const columns = [
          ...SEVERITY_BANDS.flatMap(({ id, min }) => {
            const band = severityClause(min);
            return totalsFor(id, band);
          }),
          // A cube error is named by the action taken and nothing else: the row
          // is already a mistake, so `dice_rolled` on a cube decision can only
          // be a double that should have been turned.
          ...CUBE_ERRORS.flatMap(({ id, action }) =>
            totalsFor(id, {
              sql: "(d.kind = 'cube' AND b.cube_action = ?)",
              params: [action],
            }),
          ),
        ];

        // The SELECT list binds before the WHERE that follows it.
        const bound = [...columns.flatMap(({ params }) => params), ...filterParams];

        const row = ctx.db
          .prepare(
            `${WITH_DECISIONS}
             SELECT COUNT(*) AS decisions, ${columns.map(({ sql }) => sql).join(", ")}
             FROM decisions d
             JOIN blunders b ON b.blunder_id = d.blunder_id
             JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
             WHERE ${filter}`,
          )
          .get(...bound) as Record<string, number | null>;

        // A category the filters empty sums to null rather than to zero.
        const totals = (ids: readonly string[]) =>
          Object.fromEntries(
            ids.map((id) => [
              id,
              { decisions: row[`${id}_decisions`] ?? 0, equityLost: row[`${id}_equity`] ?? 0 },
            ]),
          );

        // Safe only because `.output()` re-checks the real shape at runtime.
        return {
          decisions: row.decisions ?? 0,
          bands: totals(SEVERITIES),
          cube: totals(CUBE_ERROR_IDS),
        } as BlunderStats;
      }),

    /**
     * The highest face any cube in the data reads, which is where the Cube value
     * filter's track stops. Read from the data rather than fixed at the cube's
     * own ceiling of 64, so the slider carries no stop that cannot change the
     * list — and gains one on its own the first time a cube is turned that far.
     *
     * One number for the whole database, not per category: a filter that reshaped
     * its own track as you moved between categories would be harder to read than
     * a track that simply stops where the data does.
     */
    topCubeValue: publicProcedure.output(z.number()).query(({ ctx }) => {
      const { top } = ctx.db.prepare("SELECT MAX(cube_value) AS top FROM blunders").get() as {
        top: number | null;
      };

      // An empty database has no top face; `cubeValueLadder` floors the track at
      // two stops regardless, so the centred cube is a safe answer.
      return top ?? 1;
    }),

    /**
     * The longest match the data holds, which is what caps the Min. score
     * field: a match to `n` points can only ever be led by `n - 1` of them, so
     * anything above that is a floor no row could clear. Read from the data for
     * the reason the cube's track is — every 1,675 blunders scraped so far come
     * from 3- and 5-point matches, and a field offering the 20 a 21-point match
     * allows would be mostly stops that empty the list.
     *
     * `match_points` rather than the column: the 193 rows the scraper left
     * without a match length still name one in their XGID, so a longer match
     * can't hide among them and cap the field below a lead the data holds.
     *
     * One number for the whole database rather than per category, as the cube's
     * top face is: a field that changed its own ceiling as you moved between
     * categories would be harder to read than one that stops where the data does.
     */
    longestMatch: publicProcedure.output(z.number()).query(({ ctx }) => {
      const { longest } = ctx.db
        .prepare("SELECT MAX(match_points(match_length, source_xgid)) AS longest FROM blunders")
        .get() as { longest: number | null };

      // An empty database has no longest match. Two points is the shortest one
      // that can be led at all, which keeps the field's floor under its ceiling.
      return longest ?? 2;
    }),

    /**
     * The full analysis of one position: every play the engine weighed, the
     * cube equities, and the checker layout. Fetched on selection rather than
     * with the list, so the cost is paid once per position actually opened.
     */
    detail: publicProcedure
      .input(z.object({ category: z.string(), blunder_id: z.number().int() }))
      .output(blunderDetail.nullable())
      .query(({ ctx, input }) => {
        const row = ctx.db
          .prepare(
            `SELECT ${DETAIL_COLUMNS}
            FROM blunders b
            JOIN blunder_categories bc ON bc.blunder_id = b.blunder_id
            WHERE b.blunder_id = ? AND bc.category = ?`,
          )
          .get(input.blunder_id, input.category);

        if (!row) return null;

        // One row for most positions; two for a blunder stored as `both`.
        const decisions = ctx.db
          .prepare(
            `${WITH_DECISIONS}
             SELECT kind, error_magnitude FROM decisions WHERE blunder_id = ? ORDER BY kind`,
          )
          .all(input.blunder_id);

        const cube = ctx.db
          .prepare(
            `SELECT no_double, double_take, double_pass, optimal,
                    diff_no_double, diff_double_take, diff_double_pass,
                    doublers_best_action, receivers_best_action
             FROM cube_decisions WHERE blunder_id = ?`,
          )
          .get(input.blunder_id);

        // A cube blunder has no candidate plays: the decision was the cube, so
        // its chances live on the position itself rather than on a move.
        const candidates = ctx.db
          .prepare(
            `SELECT rank, notation, equity, equity_error, move_played,
                    win, win_gammon, win_backgammon, lose, lose_gammon,
                    lose_backgammon
             FROM candidate_moves
             WHERE blunder_id = ?
             ORDER BY rank`,
          )
          .all(input.blunder_id);

        const { source_position_value, source_xgid, ...rest } = row;

        return {
          ...rest,
          source_xgid,
          decisions,
          board: describeBoard(
            typeof source_position_value === "string" ? source_position_value : null,
          ),
          // SQLite has no boolean type; `move_played` is stored as 0 or 1.
          candidates: candidates.map((c) => ({ ...c, move_played: c.move_played === 1 })),
          cube: cube ?? null,
        } as unknown as BlunderDetail;
      }),
  }),

  /**
   * Notes are the one thing the app writes besides what it syncs from Galaxy.
   * They live in their own store, which these procedures reach only through
   * `ctx.notes` — so where notes are kept can change without anything below, or
   * anything in the browser, noticing.
   */
  notes: router({
    /** The note on one blunder, or null if it has none. */
    byBlunder: publicProcedure
      .input(z.object({ blunder_id: z.number().int() }))
      .output(note.nullable())
      .query(({ ctx, input }) => ctx.notes.get(input.blunder_id)),

    /**
     * Every blunder with a note, so the list can mark them. It is matched to the
     * list in the browser rather than joined in SQL: no store notes might move to
     * can join against the blunders file.
     */
    ids: publicProcedure.output(z.array(z.number())).query(({ ctx }) => ctx.notes.ids()),

    /**
     * Writes a note and returns what is now stored. A blank body deletes it and
     * returns null — decided here rather than in each store, so the rule can't
     * drift between backends.
     */
    save: publicProcedure
      .input(z.object({ blunder_id: z.number().int(), body: z.string().max(NOTE_MAX_LENGTH) }))
      .output(note.nullable())
      .mutation(async ({ ctx, input }) => {
        // No foreign key can guard this, since the notes file can't reference the
        // blunders file, so the check happens here against the read-only side.
        const exists = ctx.db
          .prepare("SELECT 1 FROM blunders WHERE blunder_id = ?")
          .get(input.blunder_id);
        if (!exists) {
          throw new TRPCError({ code: "NOT_FOUND", message: `No blunder ${input.blunder_id}` });
        }

        if (input.body.trim() === "") {
          await ctx.notes.remove(input.blunder_id);
          return null;
        }

        return ctx.notes.save(input.blunder_id, input.body);
      }),
  }),

  /** The server syncs from Galaxy on its own; the app only asks it to, and listens. */
  sync: router({
    /** Asks for a sync, which the job skips if one ran moments ago. Returns at once. */
    start: publicProcedure.mutation(({ ctx }) => ctx.sync.start("mount")),

    /**
     * The latest run, and what every clean run since the page's last one found,
     * including runs that finished while no page was open to see them.
     */
    status: publicProcedure
      .input(z.object({ since: z.number().int().nullable() }))
      .output(syncStatus)
      .query(({ ctx, input }) => {
        const status = ctx.sync.status();
        // No run yet means `sync_runs` may not exist yet either.
        if (input.since === null || status.runId === null) {
          return { ...status, newSince: status.newBlunders };
        }
        const { n } = ctx.db
          .prepare(
            `SELECT COALESCE(SUM(new_blunders), 0) AS n FROM sync_runs
              WHERE id > ? AND finished_at IS NOT NULL AND error IS NULL`,
          )
          .get(input.since) as { n: number };
        return { ...status, newSince: n };
      }),
  }),
});

/** The client imports only this type — never the router itself. */
export type AppRouter = typeof appRouter;
