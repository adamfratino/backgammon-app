import { percent } from "../analysis.utils";
import type { Candidate, BlunderDetail } from "../analysis.types";

interface WinningChancesProps {
  of: Candidate | BlunderDetail;
}

/**
 * The chances of every outcome from the mover's side. `win_gammon` is the
 * chance of winning *by* gammon, so it is a slice of `win`, not an addition.
 */
export function WinningChances({ of }: WinningChancesProps) {
  return (
    <div style={{ fontFamily: "monospace", fontSize: "0.85em" }}>
      <div>
        w: {percent(of.win)} (G: {percent(of.win_gammon)} B: {percent(of.win_backgammon)})
      </div>
      <div>
        b: {percent(of.lose)} (G: {percent(of.lose_gammon)} B: {percent(of.lose_backgammon)})
      </div>
    </div>
  );
}
