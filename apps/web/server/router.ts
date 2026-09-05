import { z } from "zod";
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

type Category = z.infer<typeof category>;
type Blunder = z.infer<typeof blunder>;

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
  }),
});

/** The client imports only this type — never the router itself. */
export type AppRouter = typeof appRouter;
