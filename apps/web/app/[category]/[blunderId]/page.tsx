import { notFound } from "next/navigation";
import { Provider } from "jotai";
import { Stack, Group, Separator } from "@uiid/design-system";

import { SIDEBAR_MAXWIDTH } from "@/lib/constants";
import { caller } from "@/server/caller";

import { BlunderAnalysis } from "@/components/analysis";
import { BlunderStepper } from "@/components/blunder-stepper";
import { BlunderPlays } from "@/components/blunder-plays";
import { BlunderIntroText } from "@/components/blunder-intro-text";
import { PreviousDecisions } from "@/components/previous-decisions";

interface BlunderPageProps {
  params: Promise<{ category: string; blunderId: string }>;
}

export default async function BlunderPage({ params }: BlunderPageProps) {
  const { category, blunderId } = await params;

  // `blunderId` is whatever was in the URL bar, so it is a string that may not
  // be a number at all. `Number("12abc")` is NaN and `Number("")` is 0.
  const blunder_id = Number(blunderId);
  if (!Number.isInteger(blunder_id)) notFound();

  const detail = await caller.blunders.detail({ category, blunder_id });
  if (!detail) notFound();

  // The picked play is per blunder, so each blunder gets a fresh store rather than
  // inheriting the last one's pick when Next swaps the page.
  return (
    <Provider>
      <Group ay="start" fullwidth p={6} gap={6}>
        <BlunderAnalysis detail={detail} />
        <Stack gap={6} fullwidth maxw={SIDEBAR_MAXWIDTH}>
          <BlunderStepper category={category} blunderId={blunderId} />
          <Separator />
          <BlunderIntroText
            score_black={detail.score_black}
            score_white={detail.score_white}
            match_length={detail.match_length}
            cube_value={detail.cube_value}
            crawford_state={detail.crawford_state}
            die_1={detail.die_1}
            die_2={detail.die_2}
          />
          <PreviousDecisions decisions={detail.decisions} />
          <Separator />
          <BlunderPlays candidates={detail.candidates} />
        </Stack>
      </Group>
    </Provider>
  );
}
