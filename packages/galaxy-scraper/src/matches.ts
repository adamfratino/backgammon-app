import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GalaxyClient } from "./api.ts";
import { RAW_DIR } from "./config.ts";
import type { MatchRecord } from "./transform.ts";

export type MatchClient = Pick<
  GalaxyClient,
  "fetchResults" | "fetchMatch" | "fetchMatFile" | "fetchGameReview" | "fetchHistoryPage"
>;

const MATCH_DIR = join(RAW_DIR, "matches");

const matchPath = (matchId: number): string => join(MATCH_DIR, `${matchId}.json`);

function readCached(matchId: number): MatchRecord | null {
  try {
    return JSON.parse(readFileSync(matchPath(matchId), "utf8")) as MatchRecord;
  } catch {
    // Missing, or half-written by a run that was stopped: fetch it again.
    return null;
  }
}

/** Every match cached in `raw/`, for rebuilding the database offline. */
export function readCachedMatches(): MatchRecord[] {
  if (!existsSync(MATCH_DIR)) return [];
  return readdirSync(MATCH_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => readCached(Number(file.slice(0, -".json".length))))
    .filter((record) => record !== null);
}

export interface History {
  /** The account holder's name, which no other endpoint gives. */
  selfName: string | null;
  /** Opponents' names by match, for the matches the pages walked list. */
  opponents: Map<number, string | null>;
}

/**
 * Walks the history list from page 1, up to `pages` of them. Its order within
 * a page is loose, so it can't say what's new; it's read for the names.
 */
export async function readHistory(client: MatchClient, pages = Infinity): Promise<History> {
  const history: History = { selfName: null, opponents: new Map() };
  for (let page = 1; page <= pages; page++) {
    const { analyses, totalPages, userName } = await client.fetchHistoryPage(page);
    history.selfName ??= userName ?? null;
    for (const { matchId, opponentName } of analyses) history.opponents.set(matchId, opponentName);
    if (page >= totalPages) break;
  }
  return history;
}

/** Both names from a `.mat` header, as `[Player 1 "name"]`, in player1/player2 order. */
function matNames(mat: string): [string | null, string | null] {
  const name = (n: number): string | null =>
    mat.match(new RegExp(`^; \\[Player ${n} "(.*)"\\]`, "m"))?.[1] ?? null;
  return [name(1), name(2)];
}

/**
 * A match and every game's reviews, from `raw/` when an earlier run cached it,
 * which is what lets a stopped backfill pick up where it left off. Null while
 * Galaxy hasn't analysed the match yet, so a later run asks again.
 *
 * `knownName` is the opponent's name the database already has. The `.mat` is
 * fetched only when neither it, the history list nor the cache has one.
 */
export async function pullMatch(
  client: MatchClient,
  matchId: number,
  { history, selfId, knownName }: { history: History; selfId: string; knownName: string | null },
): Promise<MatchRecord | null> {
  let record = readCached(matchId);

  if (!record) {
    const { data, meta } = await client.fetchMatch(matchId);
    if (meta?.analytics !== "ok") return null;
    const games = [];
    for (let game = 1; ; game++) {
      const { events } = (await client.fetchGameReview(matchId, game)).data;
      if (events.length === 0) break;
      games.push(events);
    }
    record = { match: data, games, selfName: null, opponentName: null };
  }

  record.selfName = history.selfName ?? record.selfName;
  record.opponentName = history.opponents.get(matchId) ?? record.opponentName;
  if (!record.opponentName && !knownName) {
    const [player1, player2] = matNames(await client.fetchMatFile(matchId));
    const selfIsPlayer1 = record.match.attributes.player1?.id === selfId;
    record.opponentName = selfIsPlayer1 ? player2 : player1;
    record.selfName ??= selfIsPlayer1 ? player1 : player2;
  }

  mkdirSync(MATCH_DIR, { recursive: true });
  writeFileSync(matchPath(matchId), JSON.stringify(record));
  return record;
}
