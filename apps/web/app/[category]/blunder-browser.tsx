"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AppRouter } from "@/server/router";
import { useTRPC } from "@/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";

type Outputs = inferRouterOutputs<AppRouter>;
type Blunder = Outputs["blunders"]["byCategory"][number];
type BlunderDetail = NonNullable<Outputs["blunders"]["detail"]>;
type Candidate = BlunderDetail["candidates"][number];
type BoardSide = NonNullable<BlunderDetail["board"]>["onRoll"];

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

export function BlunderBrowser({ category }: { category: string }) {
  const trpc = useTRPC();
  const [activeId, setActiveId] = useState<number | null>(null);

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.length === 0) return <p>No blunders in this category.</p>;

  const active = data.find((b) => b.blunder_id === activeId) ?? null;

  return (
    <>
      <ol aria-busy={isFetching}>
        {data.map((blunder) => (
          <li key={blunder.blunder_id}>
            <button
              type="button"
              aria-current={blunder.blunder_id === activeId}
              onClick={() => setActiveId(blunder.blunder_id)}
            >
              {blunder.kind} {blunder.error_magnitude.toFixed(3)}
            </button>
          </li>
        ))}
      </ol>

      {/* `key` restarts the detail query rather than showing the last position
          while the next one loads. */}
      {active ? <BlunderPanel key={active.blunder_id} summary={active} /> : null}
    </>
  );
}

/**
 * The list already carries enough to render a heading, so the summary shows
 * immediately and only the analysis below it waits on the detail query.
 */
function BlunderPanel({ summary }: { summary: Blunder }) {
  const trpc = useTRPC();
  const { isPending, error, data } = useQuery(
    trpc.blunders.detail.queryOptions({ blunder_id: summary.blunder_id }),
  );

  return (
    <article aria-label={`Blunder ${summary.blunder_id}`} style={{ maxWidth: 560 }}>
      <h2>Blunder {summary.blunder_id}</h2>
      <dl>
        <dt style={term}>Kind</dt>
        <dd style={def}>{summary.kind}</dd>

        <dt style={term}>Error</dt>
        <dd style={def}>{summary.error_magnitude.toFixed(4)}</dd>

        <dt style={term}>Severity</dt>
        <dd style={def}>{summary.error_severity ?? "—"}</dd>

        <dt style={term}>Score</dt>
        <dd style={def}>
          {summary.score_black}–{summary.score_white} to {summary.match_length ?? "—"}
        </dd>
      </dl>

      {isPending ? <p>Loading analysis...</p> : null}
      {error ? <p role="alert">Could not load analysis: {error.message}</p> : null}
      {data ? <Analysis detail={data} /> : null}
    </article>
  );
}

function Analysis({ detail }: { detail: BlunderDetail }) {
  const rolled = detail.die_1 != null && detail.die_2 != null;

  return (
    <>
      <section style={section}>
        <h3>Position</h3>
        <dl>
          <dt style={term}>Roll</dt>
          <dd style={def}>{rolled ? `${detail.die_1}-${detail.die_2}` : "—"}</dd>

          <dt style={term}>Cube</dt>
          <dd style={def}>{detail.cube_value ?? "—"}</dd>

          <dt style={term}>Crawford</dt>
          <dd style={def}>{detail.crawford_state ?? "—"}</dd>

          <dt style={term}>On roll</dt>
          <dd style={def}>{detail.board ? <Side side={detail.board.onRoll} /> : "—"}</dd>

          <dt style={term}>Opponent</dt>
          <dd style={def}>{detail.board ? <Side side={detail.board.opponent} /> : "—"}</dd>

          <dt style={term}>XGID</dt>
          <dd
            style={{
              ...def,
              fontFamily: "monospace",
              fontSize: "0.85em",
              overflowWrap: "anywhere",
            }}
          >
            {detail.source_xgid ?? "—"}
          </dd>
        </dl>
      </section>

      {detail.cube ? <CubeEquities detail={detail} /> : null}

      <section style={section}>
        <h3>{detail.candidates.length > 0 ? "Plays" : "Chances"}</h3>
        {detail.candidates.length > 0 ? (
          <Plays detail={detail} />
        ) : (
          // A cube decision has no candidate plays, so the position's own
          // chances are the only ones there are.
          <Chances of={detail} />
        )}
      </section>
    </>
  );
}

function CubeEquities({ detail }: { detail: BlunderDetail }) {
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
function Plays({ detail }: { detail: BlunderDetail }) {
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
