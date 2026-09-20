import { DicePips } from "@microcharts/react/dice-pips";
import { Group } from "@uiid/design-system";

import { roll } from "@/lib/analysis.utils";
import { DIE_FACES } from "@/lib/constants";

const DIE_SIZE = 20;

const DIE_INK = {
  "--mc-stroke": "currentColor",
  "--mc-neutral": "currentColor",
} as React.CSSProperties;

interface DiceRollProps {
  die_1: number | null;
  die_2: number | null;
}

export function DiceRoll({ die_1, die_2 }: DiceRollProps) {
  if (die_1 === null || die_2 === null) return "—";

  const high = Math.max(die_1, die_2);
  const low = Math.min(die_1, die_2);

  if (!DIE_FACES.includes(high) || !DIE_FACES.includes(low)) return roll(die_1, die_2);

  return (
    <Group gap={1} ay="center" role="img" aria-label={`Roll ${roll(die_1, die_2)}`}>
      <DicePips value={high} size={DIE_SIZE} summary={false} style={DIE_INK} />
      <DicePips value={low} size={DIE_SIZE} summary={false} style={DIE_INK} />
    </Group>
  );
}
