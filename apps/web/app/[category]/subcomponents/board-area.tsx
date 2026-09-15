"use client";

import { useState } from "react";
import { Stack, Group, Text } from "@uiid/design-system";

import type { Xgid } from "@repo/core";
import { Board } from "@repo/diagram";

import type { BlunderDetail } from "../analysis.types";

import { BlunderPlays } from "./blunder-plays";
import { CopyButton } from "./copy-button";

interface BoardAreaProps extends Pick<BlunderDetail, "source_xgid" | "candidates" | "blunder_id"> {
  /** `source_xgid`, parsed on the server so `@repo/core` stays out of the browser bundle. */
  parsed: Xgid | null;
}

export function BoardArea({ source_xgid, candidates, blunder_id, parsed }: BoardAreaProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Stack aria-label="Backgammon board area" fullwidth gap={1}>
      <BlunderPlays candidates={candidates} value={selected} onValueChange={setSelected} />
      {parsed && (
        <Board
          position={parsed.position}
          dice={parsed.dice}
          cube={parsed.cube}
          turn="player"
          move={selected}
        />
      )}
      <Group ay="center" gap={1} fullwidth ax="space-between">
        <Text size={-1} shade="muted" family="mono">
          Blunder #{blunder_id}
        </Text>
        {source_xgid && <CopyButton value={source_xgid} label="XGID" />}
      </Group>
    </Stack>
  );
}
