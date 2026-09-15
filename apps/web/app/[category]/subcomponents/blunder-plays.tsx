import { RadioGroup, type RadioGroupProps } from "@uiid/design-system";
import type { BlunderDetail } from "../analysis.types";

interface PlaysProps
  extends Pick<RadioGroupProps, "value" | "onValueChange">, Pick<BlunderDetail, "candidates"> {}

export function BlunderPlays({ value, onValueChange, candidates }: PlaysProps) {
  return (
    <>
      <RadioGroup
        label="Choose a play:"
        bordered
        orientation="horizontal"
        value={value}
        onValueChange={onValueChange}
        items={candidates.map((play) => ({
          value: play.notation as string,
          label: play.notation as string,
        }))}
      />
      {/* <ol style={{ paddingLeft: "1.5em" }}>
        {candidates.map((play) => (
          <li key={play.rank} style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "monospace" }}>
              <strong>{play.notation ?? "—"}</strong> {equity(play.equity)}
              {play.rank === 1 ? null : ` (${equity(play.equity_error)})`}
            </div>
            <div style={{ fontSize: "0.85em" }}>
              {play.move_played ? "played" : null}
              {play.move_played && play.rank === 1 ? " · " : null}
              {play.rank === 1 ? "best" : null}
            </div>
            <Chances of={play} />
          </li>
        ))}
      </ol> */}
    </>
  );
}
