import { decodeMatchId, gnubgIdToXgid } from "./position.ts";
import type { BlunderEvent, CandidateMove, MatchAttributes, Review } from "./types.ts";

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
  matches: NormalizedMatch[];
  blunders: NormalizedBlunder[];
  candidates: NormalizedCandidate[];
  cubes: NormalizedCube[];
  links: { blunder_id: number; category: string }[];
}

function normalizeMatch(match_id: number, a: MatchAttributes, selfId: string | null): NormalizedMatch {
  // player1 is normally the account holder, but confirm against the token's bg_id.
  const selfIsPlayer1 = selfId ? a.player1?.id === selfId : true;
  const self = selfIsPlayer1 ? a.player1 : a.player2;
  const opponent = selfIsPlayer1 ? a.player2 : a.player1;
  const selfScore = selfIsPlayer1 ? a.player1_score : a.player2_score;
  const opponentScore = selfIsPlayer1 ? a.player2_score : a.player1_score;
  return {
    match_id,
    finished_at: a.finished_at ?? null,
    length: a.length,
    status: a.status,
    subtype: a.subtype,
    analysis_level: a.analysis_level ?? null,
    tournament_id: a.tournament_id != null ? String(a.tournament_id) : null,
    self_id: self?.id ?? null,
    self_name: self?.name ?? null,
    self_score: selfScore ?? null,
    opponent_id: opponent?.id ?? null,
    opponent_name: opponent?.name ?? null,
    opponent_score: opponentScore ?? null,
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

/**
 * Blunders arrive as one or more events sharing a `blunder_id`. A checker
 * blunder pairs a `dice_rolled` event (the roll, plus cube analysis) with a
 * `move_commited` event (the candidate move list). Cube blunders may instead
 * arrive alone as `double_requested` / `double_accepted` / `double_rejected`.
 * Either side can be the flagged one, and both can be flagged at once.
 */
export function normalize(
  events: BlunderEvent[],
  apiCategory: string,
  selfId: string | null,
): NormalizedBatch {
  const byBlunder = new Map<number, BlunderEvent[]>();
  for (const event of events) {
    const bucket = byBlunder.get(event.blunder_id);
    if (bucket) bucket.push(event);
    else byBlunder.set(event.blunder_id, [event]);
  }

  const matches = new Map<number, NormalizedMatch>();
  const blunders: NormalizedBlunder[] = [];
  const candidates: NormalizedCandidate[] = [];
  const cubes: NormalizedCube[] = [];
  const links: { blunder_id: number; category: string }[] = [];

  for (const [blunder_id, group] of byBlunder) {
    const diceEvent = group.find((e) => e.event?.event_type === "dice_rolled");
    const moveEvent = group.find((e) => e.event?.event_type === "move_commited");

    // Prefer a cube event the engine actually flagged over a merely present one.
    const cubeEvents = group.filter((e) => CUBE_EVENT_TYPES.has(e.event?.event_type ?? ""));
    const cubeEvent =
      cubeEvents.find((e) => e.event?.reviews?.[0]?.result?.error_analysis?.is_blunder) ??
      cubeEvents[0];

    const anyEvent = moveEvent ?? cubeEvent ?? diceEvent ?? group[0];
    if (!anyEvent) continue;

    const attributes = anyEvent.match?.data?.attributes;
    if (attributes && !matches.has(anyEvent.match_id)) {
      matches.set(anyEvent.match_id, normalizeMatch(anyEvent.match_id, attributes, selfId));
    }

    const moveReview: Review | undefined = moveEvent?.event?.reviews?.[0];
    const cubeReview: Review | undefined = cubeEvent?.event?.reviews?.[0];

    // Both sides can be flagged at once: a wrong cube followed by a wrong play.
    const checkerFlagged = moveReview?.result?.error_analysis?.is_blunder === true;
    const cubeFlagged = cubeReview?.result?.error_analysis?.is_blunder === true;

    let kind: string;
    if (checkerFlagged && cubeFlagged) kind = "both";
    else if (checkerFlagged) kind = "checker";
    else if (cubeFlagged) kind = "cube";
    else kind = moveReview ? "checker" : "cube";

    // The primary row reports the checker error when there is one; the cube
    // error is preserved in its own columns either way.
    const flagged: Review | undefined = checkerFlagged
      ? moveReview
      : cubeFlagged
        ? cubeReview
        : (moveReview ?? cubeReview);
    if (!flagged) continue;

    const flaggedEventType = (checkerFlagged ? moveEvent : cubeFlagged ? cubeEvent : (moveEvent ?? cubeEvent))
      ?.event?.event_type;
    const cubeAnalysisSide = cubeReview?.result?.error_analysis;

    const result = flagged.result;
    const analysis = result?.error_analysis;
    const moves = result?.moves ?? [];
    const played = moves.find((m) => m.move_played);
    const best = moves.find((m) => m.rank === 1) ?? moves[0];
    const dice = diceEvent?.event?.rolled_dice ?? [];

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
      match_id: anyEvent.match_id,
      kind,
      flagged_event_type: flaggedEventType ?? null,
      cube_action: cubeEvent?.event?.event_type ?? null,
      color: moveEvent?.event?.color || cubeEvent?.event?.color || diceEvent?.event?.color || null,
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
      cube_position: sourceMatchState
        ? sourceMatchState.cubeOwner === 3
          ? 0
          : sourceMatchState.cubeOwner === 1
            ? 1
            : -1
        : null,
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

    const cube = cubeReview?.result?.cube_analysis ?? flagged.result?.cube_analysis;
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

    links.push({ blunder_id, category: apiCategory });
  }

  return { matches: [...matches.values()], blunders, candidates, cubes, links };
}
