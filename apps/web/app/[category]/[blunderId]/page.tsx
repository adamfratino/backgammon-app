import { notFound } from "next/navigation";
import { Provider } from "jotai";
import { Button, Stack, Group, Separator, Text, Textarea } from "@uiid/design-system";

import { openDecision, SIDEBAR_MAXWIDTH } from "@/lib/constants";
import { caller } from "@/server/caller";

import { BlunderAnalysis } from "@/components/analysis";
import { BlunderStepper } from "@/components/blunder-stepper";
import { BlunderCubeChoices } from "@/components/blunder-cube-choices";
import { BlunderPlays } from "@/components/blunder-plays";
import { BlunderIntroText } from "@/components/blunder-intro-text";
import { PreviousDecisions } from "@/components/previous-decisions";

interface BlunderPageProps {
  params: Promise<{ category: string; blunderId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BlunderPage({ params, searchParams }: BlunderPageProps) {
  const [{ category, blunderId }, query] = await Promise.all([params, searchParams]);

  // `blunderId` is whatever was in the URL bar, so it is a string that may not
  // be a number at all. `Number("12abc")` is NaN and `Number("")` is 0.
  const blunder_id = Number(blunderId);
  if (!Number.isInteger(blunder_id)) notFound();

  const detail = await caller.blunders.detail({ category, blunder_id });
  if (!detail) notFound();

  // A repeated `?decision=` arrives as an array, which is no decision asked for
  // rather than either of them — the same reading every other param gets.
  const asked = typeof query.decision === "string" ? query.decision : null;
  const decision = openDecision(detail.decisions, asked);

  // The picked play is per blunder, so each blunder gets a fresh store rather than
  // inheriting the last one's pick when Next swaps the page.
  return (
    <Provider>
      <Group ay="start" fullwidth p={6} gap={6}>
        <BlunderAnalysis detail={detail} />
        <Stack gap={6} fullwidth maxw={SIDEBAR_MAXWIDTH}>
          <BlunderStepper category={category} blunderId={blunderId} />
          <Text render={<h1 />} size={3} weight="bold">
            Blunder #{blunderId}
          </Text>
          <Separator />
          <BlunderIntroText
            score_black={detail.score_black}
            score_white={detail.score_white}
            match_length={detail.match_length}
            cube_value={detail.cube_value}
            crawford_state={detail.crawford_state}
            die_1={detail.die_1}
            die_2={detail.die_2}
            cube_action={detail.cube_action}
          />
          <PreviousDecisions decisions={detail.decisions} />
          <Separator />
          {/* A cube blunder has no candidate plays, so it is asked about the
              cube instead. The note below is about whichever was asked. */}
          {decision === "cube" ? (
            <BlunderCubeChoices cube_action={detail.cube_action} />
          ) : (
            <BlunderPlays candidates={detail.candidates} />
          )}
          <Textarea label="Any thoughts about your decision?" fullwidth />
          <Button>Submit</Button>
        </Stack>
      </Group>
    </Provider>
  );
}
