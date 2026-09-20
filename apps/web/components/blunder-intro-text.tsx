"use client";

import { useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { Text } from "@uiid/design-system";
import type { BlunderDetail, PipCounts } from "@/lib/analysis.types";
import { isWinningText, pips, roll } from "@/lib/analysis.utils";
import { matchScoreOf } from "@/lib/score";
import { CRAWFORD_STATE, cubeDirection } from "@/lib/constants";
import { pipCountsVisible } from "./board-area";
import { Activity } from "react";

interface BlunderIntroText extends Pick<
  BlunderDetail,
  | "score_black"
  | "score_white"
  | "match_length"
  | "cube_value"
  | "crawford_state"
  | "die_1"
  | "die_2"
  | "cube_action"
> {
  /** The same counts the board draws, or null when there is no position to count. */
  pipCounts: PipCounts | null;
  /** The pip-count setting as the server read it, for the first paint. */
  showPipCounts: boolean;
}

export function BlunderIntroText({
  score_black,
  score_white,
  match_length,
  cube_value,
  crawford_state,
  die_1,
  die_2,
  cube_action,
  pipCounts,
  showPipCounts,
}: BlunderIntroText) {
  // Seeded here as well as in the board. Jotai hydrates an atom once per store,
  // so whichever column renders first sets it and the other's call does nothing
  // — which is what lets this sentence match the cookie on the first paint
  // without depending on the board being rendered before it.
  useHydrateAtoms([[pipCountsVisible, showPipCounts]]);
  const countsVisible = useAtomValue(pipCountsVisible);

  const isCrawford = CRAWFORD_STATE.find((cr) => cr.id !== "none" && cr.id === crawford_state);
  const rolled = die_1 != null && die_2 != null;

  // A double you have to answer is worth twice the face the row stores, which
  // is where the cube stood before it was turned. That earlier face is the one
  // thing in the position nobody is playing for any more, so naming it as well
  // would sit beside the board contradicting the cube drawn on it.
  const doubled =
    cubeDirection(cube_action) === "receive" && cube_value != null ? cube_value * 2 : null;

  // Your points first, and the verb that goes with them. `score_white` is
  // yours — see `matchScoreOf`, which the table's Score column reads the same
  // way. A blunder the scraper kept no score for kept no match length either,
  // never one without the other, so this is the whole sentence's guard.
  const score = matchScoreOf(score_black, score_white);

  // Pips are what each side has left to bear off, so the smaller count is the
  // one in front: the near side leads by whatever the far side still owes, and a
  // dead heat is both sides sitting on the same number.
  const lead = pipCounts ? pipCounts.opponent - pipCounts.player : null;

  return (
    <>
      <Activity mode={doubled != null ? "visible" : "hidden"}>
        <Text size={3} weight="normal">
          You've been doubled to <strong>[{doubled}]</strong>.
        </Text>
      </Activity>
      <Text size={3} weight="normal" balance>
        {score && (
          <>
            {isWinningText(score.yours - score.theirs)}{" "}
            <strong>
              [{score.yours}&nbsp;-&nbsp;{score.theirs}]
            </strong>{" "}
            in a match to <strong>[{match_length}&nbsp;points]</strong>
            {isCrawford ? (
              <>
                , and you're <strong>{isCrawford?.label}</strong>.
              </>
            ) : (
              "."
            )}
          </>
        )}
        {doubled == null && cube_value != null && cube_value > 1 && (
          <>
            {" "}
            The cube is at <strong>[{cube_value}]</strong>.
          </>
        )}
        {/* Only while the board is showing its pip counts: the switch under the
          board turns the race off everywhere it is spelled out, not just there. */}
        {countsVisible && pipCounts && lead !== null && (
          <>
            {" "}
            {lead === 0 ? (
              <>
                You're even at <strong>[{pips(pipCounts.player)}]</strong>.
              </>
            ) : (
              <>
                You're{" "}
                <strong>
                  [{pips(Math.abs(lead))}&nbsp;{lead > 0 ? "ahead" : "behind"}]
                </strong>
                .
              </>
            )}
          </>
        )}{" "}
        {rolled && (
          <>
            You just rolled <strong>[{roll(die_1, die_2)}]</strong>.
          </>
        )}
      </Text>
    </>
  );
}
