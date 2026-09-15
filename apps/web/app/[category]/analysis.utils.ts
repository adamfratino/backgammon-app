/** Engine probabilities are fractions; the UI reads them as percentages. */
export function percent(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
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
