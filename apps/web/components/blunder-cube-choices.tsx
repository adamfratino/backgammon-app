"use client";

import { atom, useAtom } from "jotai";
import { RadioGroup } from "@uiid/design-system";

import { CUBE_CHOICES, cubeDirection } from "@/lib/constants";
import type { BlunderDetail } from "@/lib/analysis.types";

/**
 * The cube action picked for this blunder, or null while nothing is picked.
 * Kept apart from `selectedPlay` because the two hold different things: that one
 * is a move in checker notation, which the board draws, and `take` or `roll`
 * would only confuse it.
 */
export const selectedCubeChoice = atom<string | null>(null);

/**
 * The answers to a cube blunder. Which two are offered depends on the side of
 * the cube you were on, and `cube_action` — what you actually did — is enough to
 * say: taking or dropping is only possible once the cube has been offered to
 * you.
 */
export function BlunderCubeChoices({ cube_action }: Pick<BlunderDetail, "cube_action">) {
  const [value, setValue] = useAtom(selectedCubeChoice);

  return (
    <RadioGroup
      label="Choose an action:"
      bordered
      fullwidth
      value={value}
      onValueChange={setValue}
      items={CUBE_CHOICES[cubeDirection(cube_action)].map(({ id, label }) => ({
        value: id,
        label,
      }))}
    />
  );
}
