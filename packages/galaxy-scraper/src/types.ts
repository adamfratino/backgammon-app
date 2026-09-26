/** Shapes returned by Backgammon Galaxy's match history, match and game review endpoints. */

export interface ErrorAnalysis {
  equity_error: number;
  error_severity: string;
  is_blunder: boolean;
  is_error: boolean;
  luck: number;
  mwc_error: number;
  /** The real magnitude. `equity_error` is 0 on every record the API returns. */
  raw_error: number;
}

export interface Probabilities {
  lose: number;
  lose_backgammon: number;
  lose_gammon: number;
  mwc: number;
  mwc_context: string;
  win: number;
  win_backgammon: number;
  win_gammon: number;
}

export interface CubeAnalysis {
  cube_level?: number;
  cubeless: number;
  diff_double_pass: number;
  diff_double_take: number;
  diff_no_double: number;
  double_pass: number;
  double_take: number;
  doublers_best_action: string;
  no_double: number;
  optimal: number;
  receiver_diff_double_pass: number;
  receiver_diff_double_take: number;
  receivers_best_action: string;
}

export interface CandidateMove {
  equity: number;
  equity_error: number;
  error_analysis: ErrorAnalysis;
  final: { gnubgid: string; xgid: string } | null;
  level: number;
  move_played: boolean;
  notation: string;
  probabilities: Probabilities;
  rank: number;
}

export interface ReviewResult {
  cube_analysis?: CubeAnalysis | null;
  equity: number;
  error_analysis: ErrorAnalysis;
  metadata: {
    analysis_level: number;
    analysis_time_ms: number;
    crawford_state: string;
    match_length: number;
    scores: { black: number; white: number };
  };
  moves?: CandidateMove[] | null;
  probabilities: Probabilities;
}

export interface PositionRef {
  classification: string;
  formatted_value: string;
  id: number;
}

export interface Review {
  destination_position: PositionRef | null;
  double: boolean;
  id: number;
  level: number;
  /** The analysis sits one level down, beside what kind of decision it analysed. */
  result: { analysed_event: string; version: string; result: ReviewResult };
  source_match: PositionRef | null;
  source_position: PositionRef | null;
}

export interface MatchEvent {
  color: string | null;
  /** "game_started" | "dice_rolled" | "move_commited" | "double_requested" | "game_over" | … */
  event_type: string | null;
  id: number | null;
  moves: number[] | null;
  reviews: Review[];
  rolled_dice: number[] | null;
  /** Whose decision it was; empty on `game_over`. */
  user_id: string;
}

/** `/api/matches` names neither player; the names come from the history list or the `.mat`. */
export interface PlayerRef {
  attributes: { rating?: string };
  id: string;
  type: string;
}

/**
 * One player's analysis of the whole match. Galaxy sends error and luck totals as
 * well; only the error rate is kept, because it is the one the blunders can't be
 * summed into — they leave out every decision that went right.
 */
export interface PlayerStats {
  /** Galaxy's ER: equity given up per decision, in thousandths. Lower is better. */
  error_rate: number;
}

export interface MatchAttributes {
  analysis_level?: number;
  clock?: unknown;
  finished_at: string | null;
  length: number;
  player1: PlayerRef;
  player2: PlayerRef;
  player1_score: number;
  player2_score: number;
  player1_stats?: PlayerStats | null;
  player2_stats?: PlayerStats | null;
  private?: boolean;
  rake?: unknown;
  rating?: {
    player1_final_rating?: string;
    player2_final_rating?: string;
    transfered_points?: string;
  };
  stake?: unknown;
  status: string;
  subtype: string;
  tournament_id?: number | string | null;
}

/** `GET /api/matches/{id}`. */
export interface MatchResponse {
  data: { attributes: MatchAttributes; id: number; type: "match" };
  /** `analytics: "ok"` once Galaxy has analysed the match. */
  meta?: { analytics?: string };
}

/** `GET /match-analytics/api/v1/game_reviews/{id}/{game}`: a game past the last one has no events. */
export interface GameReviewPage {
  data: { events: MatchEvent[]; game_index: number; match_id: number };
}

/** `GET /stats/api/v3/users/analytics/results/{bg_id}`: the 50 newest matches, newest first. */
export interface ResultsResponse {
  results: { finished_at: string; match_id: number; result: "W" | "L" }[];
}

/** `GET /stats/api/v2/analyses/list/{page}`: the web client's history page, 30 matches a page. */
export interface HistoryPage {
  analyses: { matchId: number; opponentName: string | null }[];
  page: number;
  totalPages: number;
  userName: string;
}
