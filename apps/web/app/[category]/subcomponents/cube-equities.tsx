import type { BlunderDetail } from "../analysis.types";
import { equity } from "../analysis.utils";

interface CubeEquitiesProps extends Pick<BlunderDetail, "cube" | "decisions"> {}

export function CubeEquities({ cube, decisions }: CubeEquitiesProps) {
  if (!cube) return null;

  // On a checker blunder the cube was never actually turned, so these describe
  // the position rather than a decision anyone got wrong.
  const decided = decisions.some(({ kind }) => kind === "cube");

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
