import { z } from "zod";
import { publicProcedure, router } from "@/server/trpc";

/**
 * The shape this procedure promises to return. `.output()` parses every
 * response against it at runtime, so a drifting query fails here with a clear
 * error instead of sending a wrong shape to the browser.
 */
const blunder = z.object({
  blunder_id: z.number(),
  kind: z.string(),
  source_classification: z.string(),
  error_magnitude: z.number(),
  played_notation: z.string().nullable(),
  best_notation: z.string().nullable(),
});

type Blunder = z.infer<typeof blunder>;

export const appRouter = router({
  blunders: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(25) }))
      .output(z.array(blunder))
      .query(({ ctx, input }) => {
        const rows = ctx.db
          .prepare(
            `SELECT blunder_id, kind, source_classification, error_magnitude,
                    played_notation, best_notation
             FROM blunders
             ORDER BY error_magnitude DESC
             LIMIT ?`,
          )
          .all(input.limit);

        // The driver hands back untyped rows. This assertion is safe only
        // because `.output()` re-checks the real shape at runtime.
        return rows as unknown as Blunder[];
      }),
  }),
});

/** The client imports only this type — never the router itself. */
export type AppRouter = typeof appRouter;
