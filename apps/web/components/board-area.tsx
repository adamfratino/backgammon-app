"use client";

import { atom, useAtom, useAtomValue } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { Stack, Group, Switch, Text } from "@uiid/design-system";

import type { SideName, Xgid } from "@repo/core";
import { Board } from "@repo/diagram";

import type { BlunderDetail } from "@/lib/analysis.types";
import { cubeDirection } from "@/lib/constants";
import { rememberPipCounts } from "@/lib/pip-counts";

import { selectedPlay } from "./blunder-plays";
import { CopyButton } from "./copy-button";

/** Whether the board draws its pip counts. The cookie behind it is the record. */
export const pipCountsVisible = atom(true);

interface BoardAreaProps extends Pick<BlunderDetail, "source_xgid" | "blunder_id" | "cube_action"> {
  /** `source_xgid`, parsed on the server so `@repo/core` stays out of the browser bundle. */
  parsed: Xgid | null;
  /** Each side's pip count in `parsed`, counted on the server for the same reason. */
  pipCounts: Record<SideName, number> | null;
  /** The setting as the server read it, which is what this render drew. */
  showPipCounts: boolean;
}

export function BoardArea({
  source_xgid,
  blunder_id,
  cube_action,
  parsed,
  pipCounts,
  showPipCounts,
}: BoardAreaProps) {
  // Every blunder mounts its own store, so each one is seeded with the setting
  // the server just rendered rather than starting over from the default.
  useHydrateAtoms([[pipCountsVisible, showPipCounts]]);

  // Being offered the cube is the one decision the board has nothing to show
  // for: no roll, and a cube that has not moved yet. The XGID records the face
  // it was on before the double, so the offer lives in the action instead.
  const doubleOffered = cubeDirection(cube_action) === "receive";

  const selected = useAtomValue(selectedPlay);
  const [visible, setVisible] = useAtom(pipCountsVisible);

  return (
    <Stack aria-label="Backgammon board area" fullwidth gap={1}>
      {parsed && (
        <Board
          position={parsed.position}
          dice={parsed.dice}
          cube={parsed.cube}
          doubleOffered={doubleOffered}
          turn="player"
          move={selected}
          pipCounts={visible ? pipCounts : null}
        />
      )}
      <Group ay="center" gap={1} fullwidth ax="space-between">
        <Text size={-1} shade="muted" family="mono">
          Blunder #{blunder_id}
        </Text>
        <Group ay="center" gap={2}>
          <Switch
            size="xsmall"
            label="Pip counts"
            checked={visible}
            onCheckedChange={(checked) => {
              setVisible(checked);
              rememberPipCounts(checked);
            }}
          />
          {source_xgid && <CopyButton value={source_xgid} label="XGID" />}
        </Group>
      </Group>
    </Stack>
  );
}
