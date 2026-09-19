/** Engine probabilities are fractions; the UI reads them as percentages. */
export function percent(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

/** A roll reads higher die first, the way players say it: 5-1, not 1-5. */
export function roll(die_1: number | null, die_2: number | null): string {
  return die_1 == null || die_2 == null
    ? "—"
    : `${Math.max(die_1, die_2)}-${Math.min(die_1, die_2)}`;
}

/** Equities are signed, and the sign is the whole point. */
export function equity(value: number | null): string {
  return value == null ? "—" : value.toFixed(3);
}

export function isWinningText(num: number): string {
  if (num > 0) return "You're winning";
  if (num === 0) return "You're tied";
  return "You're losing";
}
