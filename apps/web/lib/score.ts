import { parseXgid } from "@repo/core";

/**
 * A match score from your side of it, which is the only side the app speaks
 * from: the board draws you nearest, the blunder page says "you just rolled",
 * and the Advantage filter offers winning, tied and losing rather than naming a
 * colour. Your points come first, the way a player says a score.
 */
export interface MatchScore {
  yours: number;
  theirs: number;
}

/**
 * The score a row stores, turned your way round. `score_white` is yours and
 * `score_black` is your opponent's.
 *
 * The scraper writes Galaxy's `metadata.scores.black` and `.white` straight
 * through, and those two keys are roles rather than the checker colours they
 * read as — you are white in every match scraped so far. Two independent
 * readings of the database agree on it. Final match scores allow "you are
 * white" on 176 of the 179 matches whose blunders are marked black and 346 of
 * 351 marked white, and 71 matches prove it outright, where a running black
 * score climbs past your own final one, against 2 that prove the reverse.
 * Match winning chance settles it: the engine always states it for the side on
 * roll, which is the side facing the decision, and it rises with white's lead
 * and only white's — trailing by two averages 0.298, by one 0.444, level 0.550,
 * ahead by one 0.674, by two 0.795.
 *
 * The `color` column is not your side and cannot stand in for it. It names the
 * player who is *not* on roll, so it is the opponent of whoever made the
 * blunder, and it is empty on 74 rows besides.
 */
export function matchScoreOf(
  scoreBlack: number | null,
  scoreWhite: number | null,
): MatchScore | null {
  if (scoreBlack === null || scoreWhite === null) return null;
  return { yours: scoreWhite, theirs: scoreBlack };
}

/**
 * The same score read off an XGID, for the 193 rows of 1,675 whose score
 * columns the scraper dropped — the same rows it dropped the match length and
 * `crawford_state` for, which is why `crawfordFilterOf` reads the XGID too. Left
 * to the columns alone, better than one row in eight would fall outside every
 * tick of a filter it belongs in.
 *
 * Both fields read off the side the board draws them on, so neither needs
 * turning round here. The scraper used to copy them out of gnubg's match id in
 * gnubg's own player order, which is unrelated to which way round the board
 * beside them was written, and they came out swapped on most rows; BG-23 made
 * it write the on-roll side's score first instead. The on-roll side is you —
 * every scraped blunder is one of yours — so `player` is yours and `opponent`
 * theirs, on every row. `pnpm --filter @repo/core verify` checks exactly this
 * against the 1,482 rows that kept their columns.
 */
function scoresFromXgid(xgid: string | null): MatchScore | null {
  const position = xgid === null ? null : parseXgid(xgid);
  if (!position) return null;

  const { player: yours, opponent: theirs } = position.scores;

  // `parseXgid` reads both fields with `Number`, so a malformed one is a NaN
  // rather than a throw, and a NaN lead would compare false against every tick.
  return Number.isInteger(yours) && Number.isInteger(theirs) ? { yours, theirs } : null;
}

/**
 * How far ahead you were, in points: positive winning, negative losing, zero
 * tied. The columns answer it where they exist and the XGID answers the rest,
 * so every row has one — and the columns come first, because they are what the
 * page beside the filter draws.
 */
export function leadOf(
  scoreBlack: number | null,
  scoreWhite: number | null,
  xgid: string | null,
): number | null {
  const score = matchScoreOf(scoreBlack, scoreWhite) ?? scoresFromXgid(xgid);
  return score === null ? null : score.yours - score.theirs;
}

/**
 * How many points the match was played to, from the column or else the XGID —
 * the same fallback, for the same 193 rows. It is what the Min. score field
 * takes its ceiling from, so a match length hiding in an XGID can't cap the
 * field below a lead the data actually holds.
 */
export function matchPointsOf(matchLength: number | null, xgid: string | null): number | null {
  if (matchLength !== null) return matchLength;

  const position = xgid === null ? null : parseXgid(xgid);
  if (!position || !Number.isInteger(position.matchLength)) return null;

  // 0 is a money game: no match, so no length to be the longest.
  return position.matchLength > 0 ? position.matchLength : null;
}
