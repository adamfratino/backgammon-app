import { z } from "zod";
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
  kind: z.string(),
  cube_action: z.string().nullable(),
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

/**
 * Everything needed to study one position. Deliberately separate from the list
 * shape above: folding candidates, cube equities and the board into
 * `byCategory` grows a 50-row page from ~15KB to ~96KB, all of which the page
 * dehydrates into the HTML to serve a row the reader may never open.
 */
const blunderDetail = probabilities.extend({
  blunder_id: z.number(),
  kind: z.string(),
  cube_action: z.string().nullable(),
  color: z.string().nullable(),
  die_1: z.number().nullable(),
  die_2: z.number().nullable(),
  error_magnitude: z.number(),
  error_severity: z.string().nullable(),
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
  board: boardPosition.nullable(),
  candidates: z.array(candidate),
  cube: cubeDecision.nullable(),
});

type Category = z.infer<typeof category>;
type Blunder = z.infer<typeof blunder>;
type BlunderDetail = z.infer<typeof blunderDetail>;

/** Read straight from `blunders`; the board is derived from the position id. */
const DETAIL_COLUMNS = `
  blunder_id, kind, cube_action, color, die_1, die_2, error_magnitude,
  error_severity, crawford_state, played_notation, best_notation,
  played_rank, candidate_count, match_length, score_black, score_white,
  cube_value, source_xgid, source_position_value, win, win_gammon,
  win_backgammon, lose, lose_gammon, lose_backgammon`;

export const appRouter = router({
  categories: router({
    /** Drives the sidebar. Changes rarely, so this one is server-rendered. */
    list: publicProcedure.output(z.array(category)).query(({ ctx }) => {
      const rows = ctx.db
        .prepare(
          `SELECT category, COUNT(*) AS count
           FROM blunder_categories
           GROUP BY category
           ORDER BY count DESC, category ASC`,
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
          limit: z.number().int().min(1).max(200).default(50),
        }),
      )
      .output(z.array(blunder))
      .query(({ ctx, input }) => {
        const rows = ctx.db
          .prepare(
            `SELECT b.blunder_id, b.kind, b.cube_action, b.error_magnitude,
                    b.error_severity, b.played_notation, b.best_notation,
                    b.match_length, b.score_black, b.score_white,
                    c.doublers_best_action, c.receivers_best_action
             FROM blunders b
             JOIN blunder_categories bc ON bc.blunder_id = b.blunder_id
             LEFT JOIN cube_decisions c ON c.blunder_id = b.blunder_id
             WHERE bc.category = ?
             ORDER BY b.error_magnitude DESC
             LIMIT ?`,
          )
          .all(input.category, input.limit);

        // The driver hands back untyped rows. This assertion is safe only
        // because `.output()` re-checks the real shape at runtime.
        return rows as unknown as Blunder[];
      }),

    /**
     * The full analysis of one position: every play the engine weighed, the
     * cube equities, and the checker layout. Fetched on selection rather than
     * with the list, so the cost is paid once per position actually opened.
     */
    detail: publicProcedure
      .input(z.object({ blunder_id: z.number().int() }))
      .output(blunderDetail.nullable())
      .query(({ ctx, input }) => {
        const row = ctx.db
          .prepare(`SELECT ${DETAIL_COLUMNS} FROM blunders WHERE blunder_id = ?`)
          .get(input.blunder_id);

        if (!row) return null;

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
