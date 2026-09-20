import { Stack } from "@uiid/design-system";

import type { Xgid } from "@repo/core";

import type { BlunderDetail, PipCounts } from "@/lib/analysis.types";
import { BoardArea } from "./board-area";
import { CubeEquities } from "./cube-equities";

interface BlunderAnalysisProps {
  detail: BlunderDetail;
  /** `source_xgid`, parsed on the server so `@repo/core` stays out of the browser bundle. */
  parsed: Xgid | null;
  /** Each side's pip count in `parsed`, counted on the server for the same reason. */
  pipCounts: PipCounts | null;
  /** The pip-count setting as the server read it, which is what this render drew. */
  showPipCounts: boolean;
  /** Which way round the server drew the board, read from its own cookie. */
  flipBoard: boolean;
}

export function BlunderAnalysis({
  detail,
  parsed,
  pipCounts,
  showPipCounts,
  flipBoard,
}: BlunderAnalysisProps) {
  const { blunder_id, decisions, source_xgid, cube, cube_action } = detail;

  return (
    <Stack aria-label={`Blunder ${blunder_id}`} render={<article />} gap={6} fullwidth ax="stretch">
      <BoardArea
        source_xgid={source_xgid}
        blunder_id={blunder_id}
        cube_action={cube_action}
        parsed={parsed}
        pipCounts={pipCounts}
        showPipCounts={showPipCounts}
        flipBoard={flipBoard}
      />
      {cube ? <CubeEquities cube={cube} decisions={decisions} /> : null}
    </Stack>
  );
}
