import { Text } from "@uiid/design-system";
import type { BlunderDetail } from "../analysis.types";
import { isWinningText, roll } from "../analysis.utils";
import { CRAWFORD_STATE } from "@/lib/constants";

interface BlunderIntroText extends Pick<
  BlunderDetail,
  | "score_black"
  | "score_white"
  | "match_length"
  | "cube_value"
  | "crawford_state"
  | "die_1"
  | "die_2"
> {}

export function BlunderIntroText({
  score_black,
  score_white,
  match_length,
  cube_value,
  crawford_state,
  die_1,
  die_2,
}: BlunderIntroText) {
  const isCrawford = CRAWFORD_STATE.find((cr) => cr.id !== "none" && cr.id === crawford_state);
  const rolled = die_1 != null && die_2 != null;

  return (
    <Text size={3} weight="normal" balance>
      {(score_black || score_white || match_length) && (
        <>
          {isWinningText(score_black! - score_white!)}{" "}
          <strong>
            [{score_black} - {score_white}]
          </strong>{" "}
          in a match to <strong>[{match_length} points]</strong>
          {isCrawford ? (
            <>
              , and you're <strong>{isCrawford?.label}</strong>.
            </>
          ) : (
            "."
          )}
        </>
      )}
      {cube_value && cube_value > 1 && (
        <>
          {" "}
          The cube is at <strong>[{cube_value}]</strong>.
        </>
      )}{" "}
      {rolled && (
        <>
          You just rolled <strong>[{roll(die_1, die_2)}]</strong>.
        </>
      )}
    </Text>
  );
}
