import type { inferRouterOutputs } from "@trpc/server";
import { Button, Stack, Group, Text, ToggleGroup, Toggle, RadioGroup } from "@uiid/design-system";

import { parseXgid } from "@repo/core";
import { Board } from "@repo/diagram";

import { CRAWFORD_STATE, severityOf } from "@/lib/constants";
import type { AppRouter } from "@/server/router";

import { CopyButton } from "./copy-button";
import { Fragment } from "react";

type Outputs = inferRouterOutputs<AppRouter>;
type BlunderDetail = NonNullable<Outputs["blunders"]["detail"]>;
type Candidate = BlunderDetail["candidates"][number];

interface BlunderAnalysisProps {
  detail: BlunderDetail;
}

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

export function BlunderAnalysis({ detail }: BlunderAnalysisProps) {
  const {
    blunder_id,
    decisions,
    score_white,
    score_black,
    match_length,
    die_1,
    die_2,
    cube_value,
    crawford_state,
    board,
    source_xgid,
    played_notation,
    candidates,
    cube,
  } = detail;

  const rolled = die_1 != null && die_2 != null;
  const parsed = source_xgid ? parseXgid(source_xgid) : null;

  const c = CRAWFORD_STATE.find((cr) => cr.id !== "none" && cr.id === crawford_state);

  function calcPos(num: number): string {
    if (num > 0) return "You're winning";
    if (num === 0) return "You're tied";
    return "You're losing";
  }

  return (
    <Stack aria-label={`Blunder ${blunder_id}`} render={<article />} gap={6} fullwidth ax="stretch">
      <Text size={4} weight="normal">
        {(score_black || score_white || match_length) && (
          <>
            {calcPos(score_black! - score_white!)}{" "}
            <strong>
              [{score_black} - {score_white}]
            </strong>{" "}
            in a match to <strong>[{match_length}]</strong>
            {c ? (
              <>
                , <strong>{c?.label}</strong>.
              </>
            ) : (
              "."
            )}
          </>
        )}
        {cube_value && cube_value > 1 && (
          <>
            {" "}
            The cube is at <strong>[{cube_value}]</strong>.
          </>
        )}{" "}
        {rolled && (
          <>
            You rolled{" "}
            <strong>
              {die_1}-{die_2}
            </strong>
            .
          </>
        )}
      </Text>

      <Stack ax="stretch">
        {decisions.map(({ kind, error_magnitude }) => {
          const mag = error_magnitude.toFixed(3);
          const sev = severityOf(Number(mag));

          return (
            <Text key={kind} size={1} color="red" weight="normal">
              ⛔ You initially made a{" "}
              {
                <strong>
                  {sev} {kind}
                </strong>
              }{" "}
              blunder [<strong>{mag}</strong>].
            </Text>
          );
        })}
      </Stack>

      <Group gap={1} ay="end">
        {candidates.length > 0 ? (
          <Plays detail={detail} />
        ) : (
          // A cube decision has no candidate plays, so the position's own
          // chances are the only ones there are.
          <Chances of={detail} />
        )}
        <Button>Submit pick</Button>
      </Group>

      <Stack aria-label="Backgammon board" fullwidth gap={1}>
        {/* The board is drawn from the XGID rather than from `board`, so the
            string shown below is provably the position on screen. gnubg lays
            every position out for the side on roll, so that side is always
            the near one — even on the rows whose XGID turn field says
            otherwise, as `pnpm --filter @repo/core verify` checks by replaying
            every play from the near side. */}
        {parsed && (
          <Board
            position={parsed.position}
            dice={parsed.dice}
            cube={parsed.cube}
            turn="player"
            move={played_notation}
          />
        )}
        <Group ay="center" gap={1} fullwidth ax="space-between">
          <Text size={-1} shade="muted" family="mono">
            Blunder #{blunder_id}
          </Text>
          {source_xgid && <CopyButton value={source_xgid} label="XGID" />}
        </Group>
      </Stack>
      {/* {cube ? <CubeEquities detail={detail} /> : null} */}
    </Stack>
  );
}

function CubeEquities({ detail }: BlunderAnalysisProps) {
  const cube = detail.cube;
  if (!cube) return null;

  // On a checker blunder the cube was never actually turned, so these describe
  // the position rather than a decision anyone got wrong.
  const decided = detail.decisions.some(({ kind }) => kind === "cube");

  if (!decided) return null;

  return (
    <section>
      <h3>Cube</h3>
      {decided ? null : <p style={{ fontSize: "0.85em" }}>No cube decision — shown for context.</p>}
      <dl style={{ fontFamily: "monospace", fontSize: "0.9em" }}>
        <dt>No Double</dt>
        <dd>{equity(cube.no_double)}</dd>

        <dt>Take</dt>
        <dd>{equity(cube.double_take)}</dd>

        <dt>Pass</dt>
        <dd>{equity(cube.double_pass)}</dd>
      </dl>
      <dl>
        <dt>Doubler&rsquo;s best action</dt>
        <dd>{cube.doublers_best_action ?? "—"}</dd>

        <dt>Receiver&rsquo;s best action</dt>
        <dd>{cube.receivers_best_action ?? "—"}</dd>
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
    <>
      <RadioGroup
        label="Choose a play:"
        bordered
        direction="horizontal"
        items={detail.candidates.map((play) => ({
          value: play.notation as string,
          label: play.notation as string,
        }))}
      />
      {/* <ol style={{ paddingLeft: "1.5em" }}>
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
      </ol> */}
    </>
  );
}
