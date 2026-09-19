"use client";

import { atom, useAtom } from "jotai";
import { Button, RadioGroup, Stack, Textarea } from "@uiid/design-system";
import type { BlunderDetail } from "../analysis.types";

export const selectedPlay = atom<string | null>(null);

export function BlunderPlays({ candidates }: Pick<BlunderDetail, "candidates">) {
  const [value, setValue] = useAtom(selectedPlay);

  return (
    <Stack fullwidth gap={6} ax="stretch">
      <RadioGroup
        label="Choose a play:"
        bordered
        fullwidth
        value={value}
        onValueChange={setValue}
        items={candidates.map((play) => ({
          value: play.notation as string,
          label: play.notation as string,
        }))}
      />
      <Textarea label="Any thoughts about your decision?" fullwidth />
      <Button>Submit</Button>
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
    </Stack>
  );
}
