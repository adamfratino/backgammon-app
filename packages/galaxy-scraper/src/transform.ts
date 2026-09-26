import { cubePositionOf, decodeMatchId, gnubgIdToXgid } from "./position.ts";
import type { CandidateMove, MatchEvent, MatchResponse, ReviewResult } from "./types.ts";

/** A match as the sync caches it in `raw/`: everything a rebuild needs, offline. */
export interface MatchRecord {
  match: MatchResponse["data"];
  /** Every game's events, in play order. */
  games: MatchEvent[][];
  selfName: string | null;
  opponentName: string | null;
}

export interface NormalizedMatch {
  match_id: number;
  finished_at: string | null;
  length: number;
  status: string;
  subtype: string;
  analysis_level: number | null;
  tournament_id: string | null;
  self_id: string | null;
  self_name: string | null;
  self_score: number | null;
  opponent_id: string | null;
  opponent_name: string | null;
  opponent_score: number | null;
  self_error_rate: number | null;
  opponent_error_rate: number | null;
}

export interface NormalizedBlunder {
  blunder_id: number;
  match_id: number;
  kind: string;
  flagged_event_type: string | null;
  cube_action: string | null;
  color: string | null;
  die_1: number | null;
  die_2: number | null;
  source_classification: string | null;
  destination_classification: string | null;
  raw_error: number | null;
  error_magnitude: number | null;
  mwc_error: number | null;
  error_severity: string | null;
  is_blunder: number;
  cube_raw_error: number | null;
  cube_error_severity: string | null;
  cube_is_blunder: number;
  luck: number | null;
  equity: number | null;
  match_length: number | null;
  score_black: number | null;
  score_white: number | null;
  crawford_state: string | null;
  analysis_level: number | null;
  source_position_id: number | null;
  source_position_value: string | null;
  source_match_value: string | null;
  gnubg_id: string | null;
  source_xgid: string | null;
  cube_value: number | null;
  cube_position: number | null;
  played_notation: string | null;
  best_notation: string | null;
  played_rank: number | null;
  candidate_count: number;
  win: number | null;
  win_gammon: number | null;
  win_backgammon: number | null;
  lose: number | null;
  lose_gammon: number | null;
  lose_backgammon: number | null;
  mwc: number | null;
}

export interface NormalizedCandidate {
  blunder_id: number;
  rank: number;
  notation: string | null;
  equity: number | null;
  equity_error: number | null;
  move_played: number;
  level: number | null;
  xgid: string | null;
  gnubgid: string | null;
  win: number | null;
  win_gammon: number | null;
  win_backgammon: number | null;
  lose: number | null;
  lose_gammon: number | null;
  lose_backgammon: number | null;
  mwc: number | null;
}

export interface NormalizedCube {
  blunder_id: number;
  cube_level: number | null;
  cubeless: number | null;
  no_double: number | null;
  double_take: number | null;
  double_pass: number | null;
  optimal: number | null;
  diff_no_double: number | null;
  diff_double_take: number | null;
  diff_double_pass: number | null;
  receiver_diff_double_take: number | null;
  receiver_diff_double_pass: number | null;
  doublers_best_action: string | null;
  receivers_best_action: string | null;
}

export interface NormalizedBatch {
  match: NormalizedMatch;
  blunders: NormalizedBlunder[];
  candidates: NormalizedCandidate[];
  cubes: NormalizedCube[];
  links: { blunder_id: number; category: string }[];
}

export function normalizeMatch(
  { match, selfName, opponentName }: MatchRecord,
  selfId: string | null,
): NormalizedMatch {
  const a = match.attributes;
  // player1 is normally the account holder, but confirm against the token's bg_id.
  const selfIsPlayer1 = selfId ? a.player1?.id === selfId : true;
  const self = selfIsPlayer1 ? a.player1 : a.player2;
  const opponent = selfIsPlayer1 ? a.player2 : a.player1;
  const selfScore = selfIsPlayer1 ? a.player1_score : a.player2_score;
  const opponentScore = selfIsPlayer1 ? a.player2_score : a.player1_score;
  const selfStats = selfIsPlayer1 ? a.player1_stats : a.player2_stats;
  const opponentStats = selfIsPlayer1 ? a.player2_stats : a.player1_stats;
  return {
    match_id: match.id,
    // Stored the way the blunder service wrote it, which the app's date filters compare against.
    finished_at: a.finished_at?.replace("T", " ") ?? null,
    length: a.length,
    status: a.status,
    subtype: a.subtype,
    analysis_level: a.analysis_level ?? null,
    tournament_id: a.tournament_id != null ? String(a.tournament_id) : null,
    self_id: self?.id ?? null,
    self_name: selfName,
    self_score: selfScore ?? null,
    opponent_id: opponent?.id ?? null,
    opponent_name: opponentName,
    opponent_score: opponentScore ?? null,
    self_error_rate: selfStats?.error_rate ?? null,
    opponent_error_rate: opponentStats?.error_rate ?? null,
  };
}

function candidateRow(blunder_id: number, move: CandidateMove): NormalizedCandidate {
  return {
    blunder_id,
    rank: move.rank,
    notation: move.notation ?? null,
    equity: move.equity ?? null,
    equity_error: move.equity_error ?? null,
    move_played: move.move_played ? 1 : 0,
    level: move.level ?? null,
    xgid: move.final?.xgid ?? null,
    gnubgid: move.final?.gnubgid ?? null,
    win: move.probabilities?.win ?? null,
    win_gammon: move.probabilities?.win_gammon ?? null,
    win_backgammon: move.probabilities?.win_backgammon ?? null,
    lose: move.probabilities?.lose ?? null,
    lose_gammon: move.probabilities?.lose_gammon ?? null,
    lose_backgammon: move.probabilities?.lose_backgammon ?? null,
    mwc: move.probabilities?.mwc ?? null,
  };
}

/** Event types that carry a cube decision rather than a checker play. */
const CUBE_EVENT_TYPES = new Set([
  "dice_rolled",
  "double_requested",
  "double_accepted",
  "double_rejected",
]);

/** The cube decisions that stand alone, rather than before a roll. */
const DOUBLE_EVENT_TYPES = new Set(["double_requested", "double_accepted", "double_rejected"]);

/** The one category the blunder service named differently from the position's own tag. */
const CATEGORY_ALIASES: Record<string, string> = { "6_prime": "six_prime" };

const analysisOf = (event: MatchEvent | undefined): ReviewResult | undefined =>
  event?.reviews?.[0]?.result?.result;

const isFlagged = (event: MatchEvent): boolean =>
  analysisOf(event)?.error_analysis?.is_blunder === true;

/**
 * My decisions the engine flagged, grouped the way the blunder service listed
 * them: a roll with the play that follows it (or the turn forfeited when the
 * clock ran out), flagged on either side, or a double, take or pass alone.
 */
function blunderGroups(events: MatchEvent[], selfId: string | null): MatchEvent[][] {
  const groups: MatchEvent[][] = [];
  for (const [i, event] of events.entries()) {
    if (event.user_id !== selfId) continue;
    if (event.event_type === "dice_rolled") {
      const next = events[i + 1];
      const played =
        next?.user_id === selfId &&
        (next.event_type === "move_commited" || next.event_type === "turn_forfeited");
      const group = played ? [event, next] : [event];
      if (group.some(isFlagged)) groups.push(group);
    } else if (DOUBLE_EVENT_TYPES.has(event.event_type ?? "") && isFlagged(event)) {
      groups.push([event]);
    }
  }
  return groups;
}

/**
 * A match and the blunders in it. A blunder is keyed on the id of its first
 * review, which only grows through a match, so ids sort in play order.
 */
export function normalize(record: MatchRecord, selfId: string | null): NormalizedBatch {
  const match = normalizeMatch(record, selfId);
  const blunders: NormalizedBlunder[] = [];
  const candidates: NormalizedCandidate[] = [];
  const cubes: NormalizedCube[] = [];
  const links: { blunder_id: number; category: string }[] = [];

  for (const group of record.games.flatMap((events) => blunderGroups(events, match.self_id))) {
    const blunder_id = group.find((e) => e.reviews?.[0])?.reviews[0]?.id;
    if (blunder_id === undefined) continue;

    const diceEvent = group.find((e) => e.event_type === "dice_rolled");
    const moveEvent = group.find((e) => e.event_type === "move_commited");
    const cubeEvent = group.find((e) => CUBE_EVENT_TYPES.has(e.event_type ?? ""));

    // Both sides can be flagged at once: a wrong cube followed by a wrong play.
    const checkerFlagged = moveEvent ? isFlagged(moveEvent) : false;
    const cubeFlagged = cubeEvent ? isFlagged(cubeEvent) : false;

    const kind = checkerFlagged && cubeFlagged ? "both" : checkerFlagged ? "checker" : "cube";

    // The primary row reports the checker error when there is one; the cube
    // error is preserved in its own columns either way.
    const flaggedEvent = checkerFlagged ? moveEvent : cubeEvent;
    const flagged = flaggedEvent?.reviews?.[0];
    if (!flagged) continue;

    const cubeAnalysisSide = analysisOf(cubeEvent)?.error_analysis;

    const result = flagged.result?.result;
    const analysis = result?.error_analysis;
    const moves = result?.moves ?? [];
    const played = moves.find((m) => m.move_played);
    const best = moves.find((m) => m.rank === 1) ?? moves[0];
    const dice = diceEvent?.rolled_dice ?? [];

    // The flagged review's ids describe the position actually faced. Only the
    // checker-play review carries the roll; a cube review is pre-roll.
    const gnubgId =
      flagged.source_position?.formatted_value && flagged.source_match?.formatted_value
        ? `${flagged.source_position.formatted_value}:${flagged.source_match.formatted_value}`
        : null;
    const sourceMatchState = flagged.source_match?.formatted_value
      ? decodeMatchId(flagged.source_match.formatted_value)
      : null;

    blunders.push({
      blunder_id,
      match_id: match.match_id,
      kind,
      flagged_event_type: flaggedEvent?.event_type ?? null,
      cube_action: cubeEvent?.event_type ?? null,
      color: moveEvent?.color || cubeEvent?.color || diceEvent?.color || null,
      die_1: dice[0] ?? null,
      die_2: dice[1] ?? null,
      source_classification: flagged.source_position?.classification || null,
      destination_classification: flagged.destination_position?.classification || null,
      raw_error: analysis?.raw_error ?? null,
      error_magnitude: analysis?.raw_error != null ? Math.abs(analysis.raw_error) : null,
      mwc_error: analysis?.mwc_error ?? null,
      error_severity: analysis?.error_severity ?? null,
      is_blunder: analysis?.is_blunder ? 1 : 0,
      cube_raw_error: cubeFlagged ? (cubeAnalysisSide?.raw_error ?? null) : null,
      cube_error_severity: cubeAnalysisSide?.error_severity ?? null,
      cube_is_blunder: cubeFlagged ? 1 : 0,
      luck: analysis?.luck ?? null,
      equity: result?.equity ?? null,
      match_length: result?.metadata?.match_length ?? null,
      score_black: result?.metadata?.scores?.black ?? null,
      score_white: result?.metadata?.scores?.white ?? null,
      crawford_state: result?.metadata?.crawford_state ?? null,
      analysis_level: result?.metadata?.analysis_level ?? null,
      source_position_id: flagged.source_position?.id ?? null,
      source_position_value: flagged.source_position?.formatted_value ?? null,
      source_match_value: flagged.source_match?.formatted_value ?? null,
      gnubg_id: gnubgId,
      source_xgid: gnubgId ? gnubgIdToXgid(gnubgId) : null,
      cube_value: sourceMatchState ? 2 ** sourceMatchState.cubeExponent : null,
      cube_position: sourceMatchState ? cubePositionOf(sourceMatchState) : null,
      played_notation: played?.notation ?? null,
      best_notation: best?.notation ?? null,
      played_rank: played?.rank ?? null,
      candidate_count: moves.length,
      win: result?.probabilities?.win ?? null,
      win_gammon: result?.probabilities?.win_gammon ?? null,
      win_backgammon: result?.probabilities?.win_backgammon ?? null,
      lose: result?.probabilities?.lose ?? null,
      lose_gammon: result?.probabilities?.lose_gammon ?? null,
      lose_backgammon: result?.probabilities?.lose_backgammon ?? null,
      mwc: result?.probabilities?.mwc ?? null,
    });

    for (const move of moves) candidates.push(candidateRow(blunder_id, move));

    const cube = analysisOf(cubeEvent)?.cube_analysis ?? result?.cube_analysis;
    if (cube) {
      cubes.push({
        blunder_id,
        cube_level: cube.cube_level ?? null,
        cubeless: cube.cubeless ?? null,
        no_double: cube.no_double ?? null,
        double_take: cube.double_take ?? null,
        double_pass: cube.double_pass ?? null,
        optimal: cube.optimal ?? null,
        diff_no_double: cube.diff_no_double ?? null,
        diff_double_take: cube.diff_double_take ?? null,
        diff_double_pass: cube.diff_double_pass ?? null,
        receiver_diff_double_take: cube.receiver_diff_double_take ?? null,
        receiver_diff_double_pass: cube.receiver_diff_double_pass ?? null,
        doublers_best_action: cube.doublers_best_action ?? null,
        receivers_best_action: cube.receivers_best_action ?? null,
      });
    }

    const classification = flagged.source_position?.classification;
    if (classification) {
      links.push({ blunder_id, category: CATEGORY_ALIASES[classification] ?? classification });
    }
  }

  return { match, blunders, candidates, cubes, links };
}
