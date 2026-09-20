import { cookies } from "next/headers";
import { Stack } from "@uiid/design-system";

import { parseXgid, pipCount } from "@repo/core";

import type { BlunderDetail } from "@/lib/analysis.types";
import { PIP_COUNTS_COOKIE, pipCountsFrom } from "@/lib/pip-counts";
import { BoardArea } from "./board-area";
import { CubeEquities } from "./cube-equities";

export async function BlunderAnalysis({ detail }: { detail: BlunderDetail }) {
  const { blunder_id, decisions, source_xgid, cube } = detail;

  const parsed = source_xgid ? parseXgid(source_xgid) : null;
  const pipCounts = parsed
    ? {
        player: pipCount(parsed.position.player),
        opponent: pipCount(parsed.position.opponent),
      }
    : null;

  // Read here rather than in the board, so the first paint already matches the
  // setting instead of correcting itself once the browser takes over.
  const showPipCounts = pipCountsFrom((await cookies()).get(PIP_COUNTS_COOKIE)?.value);

  return (
    <Stack aria-label={`Blunder ${blunder_id}`} render={<article />} gap={6} fullwidth ax="stretch">
      <BoardArea
        source_xgid={source_xgid}
        blunder_id={blunder_id}
        parsed={parsed}
        pipCounts={pipCounts}
        showPipCounts={showPipCounts}
      />
      {cube ? <CubeEquities cube={cube} decisions={decisions} /> : null}
    </Stack>
  );
}
