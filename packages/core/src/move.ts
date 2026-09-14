import { BAR_PIP } from "./constants.ts";

/** Where a borne-off checker goes, one pip past the 1 point. */
export const OFF_PIP = 0;

/**
 * One checker's journey between two stops, in the mover's own numbering.
 * `from` is `BAR_PIP` for a checker entering from the bar, and `to` is
 * `OFF_PIP` for one bearing off, so `from - to` is always the pips travelled.
 */
export interface CheckerMove {
  from: number;
  to: number;
  /** An opposing blot was sent to the bar on landing. */
  hit: boolean;
}

/** `bar/22*`, `13/7*\/5`, `6/off(2)` — a start, one or more stops, and an optional repeat. */
const TOKEN = /^(bar|\d+)((?:\/(?:\d+|off)\*?)+)(?:\((\d+)\))?$/;
const STOP = /\/(\d+|off)(\*?)/g;

/**
 * Parses a play in the notation GNU BG and XG write — `13/9(3) 6/2*`,
 * `bar/22*\/17*`, `3/off(2)` — into the checker moves it is made of, in the
 * order they are written. `null` if any part of it isn't that notation.
 *
 * A chain like `13/7*\/5` is one checker stopping twice, so it becomes two moves.
 * A repeat like `(2)` is that many checkers making the same journey; only the
 * first can hit, since the blot is gone by the time the next one lands.
 */
export function parseMove(notation: string): CheckerMove[] | null {
  const tokens = notation.trim().toLowerCase().split(/\s+/);
  const moves: CheckerMove[] = [];

  for (const token of tokens) {
    const match = TOKEN.exec(token);
    if (!match) return null;

    const [, start = "", stops = "", repeat] = match;
    const origin = start === "bar" ? BAR_PIP : Number(start);

    const journey: CheckerMove[] = [];
    let from = origin;
    for (const [, stop, star] of stops.matchAll(STOP)) {
      const to = stop === "off" ? OFF_PIP : Number(stop);
      // A checker only ever travels toward its own home, so a stop behind it
      // means the string is something other than a play.
      if (to >= from || from > BAR_PIP) return null;
      journey.push({ from, to, hit: star === "*" });
      from = to;
    }

    const times = repeat === undefined ? 1 : Number(repeat);
    for (let index = 0; index < times; index++) {
      for (const step of journey) moves.push({ ...step, hit: index === 0 && step.hit });
    }
  }

  return moves;
}
