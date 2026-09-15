import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/router";

export type Outputs = inferRouterOutputs<AppRouter>;
export type BlunderDetail = NonNullable<Outputs["blunders"]["detail"]>;
export type Candidate = BlunderDetail["candidates"][number];

export interface BlunderAnalysisProps {
  detail: BlunderDetail;
}
