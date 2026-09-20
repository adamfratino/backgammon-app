import { Group } from "@uiid/design-system";
import {
  Dice1Icon,
  Dice2Icon,
  Dice3Icon,
  Dice4Icon,
  Dice5Icon,
  Dice6Icon,
  type Icon,
} from "@uiid/design-system/icons";

import { roll } from "@/lib/analysis.utils";

/** A die reads 1 to 6, and the design system ships a pipped face for each. */
const DIE_ICONS: Record<number, Icon> = {
  1: Dice1Icon,
  2: Dice2Icon,
  3: Dice3Icon,
  4: Dice4Icon,
  5: Dice5Icon,
  6: Dice6Icon,
};

/**
 * Shared with `CubeIcon`, which sits in the column beside this one.
 *
 * A pip is a zero-length line with a round cap, so its diameter is exactly the
 * stroke width and nothing else makes the pips bigger. Lucide spaces them four
 * units apart on a 24-unit grid, so 3 is the ceiling — past it neighbouring
 * pips touch and a 5 stops looking like a 5.
 */
const DIE_STROKE = 3;

/** Larger than the row's text, because a pip has to be counted, not just seen. */
const DIE_SIZE = "2em";

interface DiceRollProps {
  die_1: number | null;
  die_2: number | null;
}

/**
 * The roll as two faces, higher first — the order `roll` writes it in, and the
 * order players say it.
 *
 * The faces carry no text of their own, so the pair is labelled as a single
 * image and is announced as the roll rather than as two anonymous graphics.
 * They are drawn at the cube's size and weight so the two icon columns read as
 * one set.
 */
export function DiceRoll({ die_1, die_2 }: DiceRollProps) {
  if (die_1 === null || die_2 === null) return "—";

  const High = DIE_ICONS[Math.max(die_1, die_2)];
  const Low = DIE_ICONS[Math.min(die_1, die_2)];

  // Nothing but 1 to 6 has a face to draw, so anything else falls back to the
  // roll in writing rather than leaving the cell empty.
  if (!High || !Low) return roll(die_1, die_2);

  return (
    <Group gap={1} role="img" aria-label={`Roll ${roll(die_1, die_2)}`}>
      <High size={DIE_SIZE} strokeWidth={DIE_STROKE} />
      <Low size={DIE_SIZE} strokeWidth={DIE_STROKE} />
    </Group>
  );
}
