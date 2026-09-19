"use client";

import { useAtomValue } from "jotai";
import { Stack, Group, Text } from "@uiid/design-system";

import type { SideName, Xgid } from "@repo/core";
import { Board } from "@repo/diagram";

import type { BlunderDetail } from "@/lib/analysis.types";

import { selectedPlay } from "./blunder-plays";
import { CopyButton } from "./copy-button";

interface BoardAreaProps extends Pick<BlunderDetail, "source_xgid" | "blunder_id"> {
  /** `source_xgid`, parsed on the server so `@repo/core` stays out of the browser bundle. */
  parsed: Xgid | null;
  /** Each side's pip count in `parsed`, counted on the server for the same reason. */
  pipCounts: Record<SideName, number> | null;
}

export function BoardArea({ source_xgid, blunder_id, parsed, pipCounts }: BoardAreaProps) {
  const selected = useAtomValue(selectedPlay);
  return (
    <Stack aria-label="Backgammon board area" fullwidth gap={1}>
      {parsed && (
        <Board
          position={parsed.position}
          dice={parsed.dice}
          cube={parsed.cube}
          turn="player"
          move={selected}
          pipCounts={pipCounts}
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
