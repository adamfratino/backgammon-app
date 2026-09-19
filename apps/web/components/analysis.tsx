import { Stack } from "@uiid/design-system";

import { parseXgid, pipCount } from "@repo/core";

import type { BlunderDetail } from "@/lib/analysis.types";
import { BoardArea } from "./board-area";
import { CubeEquities } from "./cube-equities";

export function BlunderAnalysis({ detail }: { detail: BlunderDetail }) {
  const { blunder_id, decisions, source_xgid, cube } = detail;

  const parsed = source_xgid ? parseXgid(source_xgid) : null;
  const pipCounts = parsed
    ? {
        player: pipCount(parsed.position.player),
        opponent: pipCount(parsed.position.opponent),
      }
    : null;

  return (
    <Stack aria-label={`Blunder ${blunder_id}`} render={<article />} gap={6} fullwidth ax="stretch">
      <BoardArea
        source_xgid={source_xgid}
        blunder_id={blunder_id}
        parsed={parsed}
        pipCounts={pipCounts}
      />
      {cube ? <CubeEquities cube={cube} decisions={decisions} /> : null}
    </Stack>
  );
}
