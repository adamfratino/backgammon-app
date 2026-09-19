import { parseXgid } from "@repo/core";

import type { CrawfordFilter } from "@/lib/constants";

/**
 * Which side of the Crawford game a position sits on, read off its XGID.
 *
 * The scraper writes a `crawford_state` column too, but it is null on 193 of the
 * 1,675 scraped blunders — the same rows whose scores and match length it also
 * dropped — so filtering on that column would hide roughly one blunder in eight
 * behind every Crawford tick. The XGID is on every row and carries the Crawford
 * flag, both scores and the match length, which is all the rule needs. Where the
 * column does have a value this agrees with it on all 1,482 rows.
 *
 * The Crawford game itself is flagged in the XGID. That flag goes off again
 * afterwards, so post-Crawford is told from pre- by the leader already sitting
 * one point short of the match.
 */
export function crawfordFilterOf(xgid: string | null): CrawfordFilter | null {
  const position = xgid === null ? null : parseXgid(xgid);
  // Match length 0 is a money game: no match, so no Crawford game to be either
  // side of. `parseXgid` reads the field with `Number`, so guard the non-numbers.
  if (!position || !Number.isInteger(position.matchLength) || position.matchLength < 1) return null;
  if (position.crawford) return "crawford";

  const matchPoint = position.matchLength - 1;
  const { player, opponent } = position.scores;
  return player === matchPoint || opponent === matchPoint ? "post" : "pre";
}
