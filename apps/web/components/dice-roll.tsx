import { DicePips } from "@microcharts/react/dice-pips";
import { Group } from "@uiid/design-system";

import { roll } from "@/lib/analysis.utils";
import { DIE_FACES } from "@/lib/constants";

/**
 * Matched to the cube in the next column, which is drawn at `2em`. A die here
 * sizes itself from a number rather than a length, so this is that `2em`
 * measured: the root sets 14px, which puts the cube at 28 square.
 */
const DIE_SIZE = 28;

/**
 * The die in the row's own ink, which is where the cube beside it already is.
 *
 * Its pips fill `--mc-stroke` and its outline strokes `--mc-neutral`, both of
 * which the app's chart theme points at fixed greys — right for a panel that
 * sits on its own, wrong for a glyph in a line of text that should go grey with
 * the rest of the row. Pointing both at `currentColor` is what the icons it
 * replaces did, and it keeps the two icon columns reading as one set.
 */
const DIE_INK = {
  "--mc-stroke": "currentColor",
  "--mc-neutral": "currentColor",
} as React.CSSProperties;

interface DiceRollProps {
  die_1: number | null;
  die_2: number | null;
}

/**
 * The roll as two faces, higher first — the order `roll` writes it in, and the
 * order players say it.
 *
 * Pips drawn as a chart rather than as an icon: a face here is counted, not
 * recognised, and `DicePips` lays its pips out on a grid built for reading at
 * this size where an icon font's are spaced for a glyph. The faces carry no
 * text of their own, so each one's own summary is turned off and the pair is
 * labelled as a single image — announced as the roll rather than as two
 * anonymous graphics, or worse, as two pip counts.
 */
export function DiceRoll({ die_1, die_2 }: DiceRollProps) {
  if (die_1 === null || die_2 === null) return "—";

  const high = Math.max(die_1, die_2);
  const low = Math.min(die_1, die_2);

  // Nothing but 1 to 6 has a face to draw, so anything else falls back to the
  // roll in writing rather than leaving the cell empty. `DicePips` would set a
  // 7 as a numeral, which is a die that does not exist.
  if (!DIE_FACES.includes(high) || !DIE_FACES.includes(low)) return roll(die_1, die_2);

  return (
    <Group gap={1} ay="center" role="img" aria-label={`Roll ${roll(die_1, die_2)}`}>
      <DicePips value={high} size={DIE_SIZE} summary={false} style={DIE_INK} />
      <DicePips value={low} size={DIE_SIZE} summary={false} style={DIE_INK} />
    </Group>
  );
}
