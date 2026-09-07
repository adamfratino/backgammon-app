import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/server/router";

type Outputs = inferRouterOutputs<AppRouter>;
type BlunderDetail = NonNullable<Outputs["blunders"]["detail"]>;
type Candidate = BlunderDetail["candidates"][number];
type BoardSide = NonNullable<BlunderDetail["board"]>["onRoll"];

interface BlunderAnalysisProps {
  detail: BlunderDetail;
}

const term = { fontWeight: "bold" } as const;
const def = { marginLeft: 0, marginBottom: 8 } as const;
const section = { marginTop: 24 } as const;

/** Engine probabilities are fractions; the UI reads them as percentages. */
function percent(value: number | null): string {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}

/** Equities are signed, and the sign is the whole point. */
function equity(value: number | null): string {
  return value == null ? "—" : value.toFixed(3);
}

/**
 * The chances of every outcome from the mover's side. `win_gammon` is the
 * chance of winning *by* gammon, so it is a slice of `win`, not an addition.
 */
function Chances({ of }: { of: Candidate | BlunderDetail }) {
  return (
    <div style={{ fontFamily: "monospace", fontSize: "0.85em" }}>
      <div>
        w: {percent(of.win)} (G: {percent(of.win_gammon)} B: {percent(of.win_backgammon)})
      </div>
      <div>
        b: {percent(of.lose)} (G: {percent(of.lose_gammon)} B: {percent(of.lose_backgammon)})
      </div>
    </div>
  );
}

/**
 * One side of the position. Points run from that side's own 24 point down to
 * its 1, so both sides read from their own home board.
 */
function Side({ side }: { side: BoardSide }) {
  return (
    <span style={{ fontFamily: "monospace", fontSize: "0.85em" }}>
      bar {side.bar}, off {side.off} — {side.points}
    </span>
  );
}

/**
 * The whole panel, server-rendered. Part 2 split this in two — a summary from
 * the list row, then the analysis once its query resolved. The route renders
 * both at once, and `detail` carries the summary fields, so the split is gone.
 */
export function BlunderAnalysis({ detail }: BlunderAnalysisProps) {
  const {
    blunder_id,
    kind,
    error_magnitude,
    error_severity,
    score_white,
    score_black,
    match_length,
    die_1,
    die_2,
    cube_value,
    crawford_state,
    board,
    source_xgid,
    candidates,
    cube,
  } = detail;

  const rolled = die_1 != null && die_2 != null;

  return (
    <article aria-label={`Blunder ${blunder_id}`} style={{ maxWidth: 560 }}>
      <h2>Blunder {blunder_id}</h2>
      <dl>
        <dt style={term}>Kind</dt>
        <dd style={def}>{kind}</dd>

        <dt style={term}>Error</dt>
        <dd style={def}>{error_magnitude.toFixed(4)}</dd>

        <dt style={term}>Severity</dt>
        <dd style={def}>{error_severity ?? "—"}</dd>

        <dt style={term}>Score</dt>
        <dd style={def}>
          {score_black}–{score_white} to {match_length ?? "—"}
        </dd>
      </dl>

      <section style={section}>
        <h3>Position</h3>
        <dl>
          <dt style={term}>Roll</dt>
          <dd style={def}>{rolled ? `${die_1}-${die_2}` : "—"}</dd>

          <dt style={term}>Cube</dt>
          <dd style={def}>{cube_value ?? "—"}</dd>

          <dt style={term}>Crawford</dt>
          <dd style={def}>{crawford_state ?? "—"}</dd>

          <dt style={term}>On roll</dt>
          <dd style={def}>{board ? <Side side={board.onRoll} /> : "—"}</dd>

          <dt style={term}>Opponent</dt>
          <dd style={def}>{board ? <Side side={board.opponent} /> : "—"}</dd>

          <dt style={term}>XGID</dt>
          <dd
            style={{
              ...def,
              fontFamily: "monospace",
              fontSize: "0.85em",
              overflowWrap: "anywhere",
            }}
          >
            {source_xgid ?? "—"}
          </dd>
        </dl>
      </section>

      {cube ? <CubeEquities detail={detail} /> : null}

      <section style={section}>
        <h3>{candidates.length > 0 ? "Plays" : "Chances"}</h3>
        {candidates.length > 0 ? (
          <Plays detail={detail} />
        ) : (
          // A cube decision has no candidate plays, so the position's own
          // chances are the only ones there are.
          <Chances of={detail} />
        )}
      </section>
    </article>
  );
}

function CubeEquities({ detail }: BlunderAnalysisProps) {
  const cube = detail.cube;
  if (!cube) return null;

  // On a checker blunder the cube was never actually turned, so these describe
  // the position rather than a decision anyone got wrong.
  const decided = detail.kind === "cube" || detail.kind === "both";

  return (
    <section style={section}>
      <h3>Cube</h3>
      {decided ? null : <p style={{ fontSize: "0.85em" }}>No cube decision — shown for context.</p>}
      <dl style={{ fontFamily: "monospace", fontSize: "0.9em" }}>
        <dt style={term}>No Double</dt>
        <dd style={def}>{equity(cube.no_double)}</dd>

        <dt style={term}>Take</dt>
        <dd style={def}>{equity(cube.double_take)}</dd>

        <dt style={term}>Pass</dt>
        <dd style={def}>{equity(cube.double_pass)}</dd>
      </dl>
      <dl>
        <dt style={term}>Doubler&rsquo;s best action</dt>
        <dd style={def}>{cube.doublers_best_action ?? "—"}</dd>

        <dt style={term}>Receiver&rsquo;s best action</dt>
        <dd style={def}>{cube.receivers_best_action ?? "—"}</dd>
      </dl>
    </section>
  );
}

/**
 * Every play the engine weighed, best first. Rank 1 is its choice, so its
 * equity is the benchmark and the rest are shown as the equity they give up.
 */
function Plays({ detail }: BlunderAnalysisProps) {
  return (
    <ol style={{ paddingLeft: "1.5em" }}>
      {detail.candidates.map((play) => (
        <li key={play.rank} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: "monospace" }}>
            <strong>{play.notation ?? "—"}</strong> {equity(play.equity)}
            {play.rank === 1 ? null : ` (${equity(play.equity_error)})`}
          </div>
          <div style={{ fontSize: "0.85em" }}>
            {play.move_played ? "played" : null}
            {play.move_played && play.rank === 1 ? " · " : null}
            {play.rank === 1 ? "best" : null}
          </div>
          <Chances of={play} />
        </li>
      ))}
    </ol>
  );
}
