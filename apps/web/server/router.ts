import { z } from "zod";

import {
  CUBE_ACTION,
  cubeDirection,
  DIRECTIONS,
  KINDS,
  PER_PAGE,
  SEVERITIES,
  SEVERITY_BANDS,
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
  count: z.number(),
});

const blunder = z.object({
  blunder_id: z.number(),
  kind: z.enum(KINDS),
  cube_action: z.enum(CUBE_ACTION).nullable(),
  error_magnitude: z.number(),
  error_severity: z.string().nullable(),
  played_notation: z.string().nullable(),
  best_notation: z.string().nullable(),
  match_length: z.number().nullable(),
  score_black: z.number().nullable(),
  score_white: z.number().nullable(),
  doublers_best_action: z.string().nullable(),
  receivers_best_action: z.string().nullable(),
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
  crawford_state: z.string().nullable(),
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

type Category = z.infer<typeof category>;
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
    SELECT blunder_id, 'checker' AS kind, error_magnitude, played_notation, best_notation
    FROM blunders
    WHERE kind IN ('checker', 'both')
    UNION ALL
    SELECT blunder_id, 'cube', ABS(cube_raw_error), NULL, NULL
    FROM blunders
    WHERE kind IN ('cube', 'both')
  )`;

export const appRouter = router({
  categories: router({
    /** Drives the sidebar. Changes rarely, so this one is server-rendered. */
    list: publicProcedure.output(z.array(category)).query(({ ctx }) => {
      const rows = ctx.db
        .prepare(
          `${WITH_DECISIONS}
           SELECT bc.category, COUNT(*) AS count
           FROM decisions d
           JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
           GROUP BY bc.category
           ORDER BY count DESC, bc.category ASC`,
        )
        .all();

      return rows as unknown as Category[];
    }),
  }),

  blunders: router({
    byCategory: publicProcedure
      .input(
        z.object({
          category: z.string(),
          page: z.number().int().min(1).default(1),
          kinds: z.array(z.enum(KINDS)).default([]),
          severities: z.array(z.enum(SEVERITIES)).default([]),
          directions: z.array(z.enum(DIRECTIONS)).default([]),
        }),
      )
      .output(z.object({ blunders: z.array(blunder), total: z.number() }))
      .query(({ ctx, input }) => {
        // Conditions are assembled here; every value they compare against is
        // bound, so nothing from the URL is ever part of the SQL itself.
        const where = ["bc.category = ?"];
        const params: (string | number)[] = [input.category];

        if (input.kinds.length > 0) {
          where.push(`d.kind IN (${input.kinds.map(() => "?").join(", ")})`);
          params.push(...input.kinds);
        }

        if (input.severities.length > 0) {
          // A band runs from its own `min` up to the next one above it, and the
          // top band has no ceiling.
          const clauses = SEVERITY_BANDS.filter((band) => input.severities.includes(band.id)).map(
            (band) => {
              const above = SEVERITY_BANDS.filter(({ min }) => min > band.min).at(-1);
              params.push(band.min);
              if (!above) return "d.error_magnitude >= ?";
              params.push(above.min);
              return "(d.error_magnitude >= ? AND d.error_magnitude < ?)";
            },
          );
          where.push(`(${clauses.join(" OR ")})`);
        }

        if (input.directions.length > 0) {
          // A checker decision has no cube action, so asking for a direction is
          // also asking for cube decisions.
          const actions = CUBE_ACTION.filter((action) =>
            input.directions.includes(cubeDirection(action)),
          );
          where.push(`d.kind = 'cube'`);
          where.push(`b.cube_action IN (${actions.map(() => "?").join(", ")})`);
          params.push(...actions);
        }

        const filter = where.join(" AND ");

        const rows = ctx.db
          .prepare(
            `${WITH_DECISIONS}
             SELECT d.blunder_id, d.kind, b.cube_action, d.error_magnitude,
                    b.error_severity, d.played_notation, d.best_notation,
                    b.match_length, b.score_black, b.score_white,
                    c.doublers_best_action, c.receivers_best_action
             FROM decisions d
             JOIN blunders b ON b.blunder_id = d.blunder_id
             JOIN blunder_categories bc ON bc.blunder_id = d.blunder_id
             LEFT JOIN cube_decisions c ON c.blunder_id = d.blunder_id
             WHERE ${filter}
             ORDER BY d.error_magnitude DESC
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

        // The driver hands back untyped rows. This assertion is safe only
        // because `.output()` re-checks the real shape at runtime.
        return { blunders: rows as unknown as Blunder[], total };
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
});

/** The client imports only this type — never the router itself. */
export type AppRouter = typeof appRouter;
