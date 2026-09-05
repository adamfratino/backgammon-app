/** Shapes returned by the Backgammon Galaxy blunder service. */

export type CategoryCounts = Record<string, number>;

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
  resigned_points: number;
  result: ReviewResult;
  second: number;
  source_match: PositionRef | null;
  source_position: PositionRef | null;
  take: boolean;
  threshold: number;
}

export interface MatchEvent {
  color: string | null;
  cube_limit: number;
  /** "dice_rolled" | "move_commited" */
  event_type: string | null;
  id: number | null;
  moves: number[] | null;
  reviews: Review[];
  rolled_dice: number[] | null;
  type: string;
  user_id: string;
}

export interface PlayerRef {
  attributes: { rating?: string };
  id: string;
  name: string;
  type: string;
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
  player1_stats?: unknown;
  player2_stats?: unknown;
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

export interface BlunderEvent {
  blunder_id: number;
  event: MatchEvent;
  match: { data: { attributes: MatchAttributes; id: number; type: string }; meta?: unknown };
  match_game_points_summary?: unknown;
  match_id: number;
  type: string;
}

export interface CategoryPage {
  data: { events: BlunderEvent[] };
  type: string;
}
