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
  cubeDirection,
  DEFAULT_SORT,
  KIND_FILTER_IDS,
  KIND_FILTERS,
  KINDS,
  type KindFilter,
  NOTE_MAX_LENGTH,
  PER_PAGE,
  SEVERITIES,
  SEVERITY_BANDS,
  SORT_IDS,
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
 * The filters that are a list of options, which are the ones that can be counted
 * one option at a time. Cube value is a range instead, so it has no options to
 * count — but it still narrows every count here, like any group that isn't the
 * one being counted.
 */
const COUNTED_GROUPS = ["kinds", "severities", "crawfords"] as const;

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
});

export type FilterCounts = z.infer<typeof filterCounts>;

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

  return [...groups, cubeValueClause(filters.cubeValue)].filter((clause) => clause !== null);
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
                    b.score_white, b.cube_value, date(m.finished_at) AS finished_on
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
     * What each option in Kind, Severity and Crawford would leave in this
     * category, so the panel can badge them: one number per option, all of them
     * out of one pass over the category's rows.
     *
     * Every group is counted with its own ticks left out and every other group's
     * kept, so an option reads as what picking it gives rather than what it adds
     * to what is already picked beside it. In `blitz` under Severity =
     * Catastrophic the three Kind options divide that band between them — 13, 0
     * and 10 — where counted the other way, ticking Checker plays would leave
     * the other two reading 13 and 23 and none of the three meaning anything.
     */
    filterCounts: publicProcedure
      .input(blunderFilters.extend({ category: z.string() }))
      .output(filterCounts)
      .query(({ ctx, input }) => {
        // What the rest of the panel narrows to — once per group, rather than
        // once per option, since every option in a group is counted under it.
        const rest = {
          kinds: allOf(filterClauses(input, "kinds")),
          severities: allOf(filterClauses(input, "severities")),
          crawfords: allOf(filterClauses(input, "crawfords")),
        };

        // One column per option. `group` and `id` are this file's own constants
        // rather than anything a request sent, which is what makes them safe to
        // name a column with; every value is still bound.
        const columns = FILTER_OPTIONS.map(({ group, id, clause }) => ({
          sql: `SUM(CASE WHEN ${rest[group].sql} AND ${clause.sql} THEN 1 ELSE 0 END) AS ${group}_${id}`,
          params: [...rest[group].params, ...clause.params],
        }));

        // The columns bind before the category does: a SELECT list is read
        // before the WHERE that follows it.
        const bound = [...columns.flatMap((column) => column.params), input.category];

        const row = ctx.db
          .prepare(
            `${WITH_DECISIONS}
             SELECT ${columns.map(({ sql }) => sql).join(", ")}
             FROM decisions d
             JOIN blunders b ON b.blunder_id = d.blunder_id
             JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
             WHERE bc.category = ?`,
          )
          .get(...bound) as Record<string, number | null>;

        // A category holding no rows at all sums to null rather than to zero,
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
        } as FilterCounts;
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
   * Notes are the one thing the app writes. They live in their own store, which
   * these procedures reach only through `ctx.notes` — so where notes are kept can
   * change without anything below, or anything in the browser, noticing.
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
});

/** The client imports only this type — never the router itself. */
export type AppRouter = typeof appRouter;
