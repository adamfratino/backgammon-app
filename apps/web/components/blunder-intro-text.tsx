import { Text } from "@uiid/design-system";
import type { BlunderDetail } from "@/lib/analysis.types";
import { isWinningText, roll } from "@/lib/analysis.utils";
import { CRAWFORD_STATE, cubeDirection } from "@/lib/constants";

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
> {}

export function BlunderIntroText({
  score_black,
  score_white,
  match_length,
  cube_value,
  crawford_state,
  die_1,
  die_2,
  cube_action,
}: BlunderIntroText) {
  const isCrawford = CRAWFORD_STATE.find((cr) => cr.id !== "none" && cr.id === crawford_state);
  const rolled = die_1 != null && die_2 != null;

  // A double you have to answer is worth twice the face the row stores, which
  // is where the cube stood before it was turned. That earlier face is the one
  // thing in the position nobody is playing for any more, so naming it as well
  // would sit beside the board contradicting the cube drawn on it.
  const doubled =
    cubeDirection(cube_action) === "receive" && cube_value != null ? cube_value * 2 : null;

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
      {doubled != null && (
        <>
          {" "}
          You&rsquo;ve been doubled to <strong>[{doubled}]</strong>.
        </>
      )}
      {doubled == null && cube_value != null && cube_value > 1 && (
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
