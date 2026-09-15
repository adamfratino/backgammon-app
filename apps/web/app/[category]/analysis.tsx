import { Stack } from "@uiid/design-system";

import { parseXgid } from "@repo/core";

import type { BlunderDetail } from "./analysis.types";
import { BlunderIntroText } from "./subcomponents/blunder-intro-text";
import { BoardArea } from "./subcomponents/board-area";
import { PreviousDecisions } from "./subcomponents/previous-decisions";
import { CubeEquities } from "./subcomponents/cube-equities";

export function BlunderAnalysis({ detail }: { detail: BlunderDetail }) {
  const {
    blunder_id,
    decisions,
    score_white,
    score_black,
    source_xgid,
    candidates,
    match_length,
    die_1,
    die_2,
    cube,
    cube_value,
    crawford_state,
  } = detail;

  const parsed = source_xgid ? parseXgid(source_xgid) : null;

  return (
    <Stack aria-label={`Blunder ${blunder_id}`} render={<article />} gap={6} fullwidth ax="stretch">
      <BlunderIntroText
        score_black={score_black}
        score_white={score_white}
        match_length={match_length}
        cube_value={cube_value}
        crawford_state={crawford_state}
        die_1={die_1}
        die_2={die_2}
      />
      <PreviousDecisions decisions={decisions} />
      <BoardArea
        source_xgid={source_xgid}
        candidates={candidates}
        blunder_id={blunder_id}
        parsed={parsed}
      />
      {cube ? <CubeEquities cube={cube} decisions={decisions} /> : null}
    </Stack>
  );
}
