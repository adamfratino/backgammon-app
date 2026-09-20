import type { inferRouterOutputs } from "@trpc/server";
import type { SideName } from "@repo/core";
import type { AppRouter } from "@/server/router";

export type Outputs = inferRouterOutputs<AppRouter>;
export type BlunderDetail = NonNullable<Outputs["blunders"]["detail"]>;
export type Candidate = BlunderDetail["candidates"][number];

/** Each side's pips left to bear off, keyed the way the board's position is. */
export type PipCounts = Record<SideName, number>;
