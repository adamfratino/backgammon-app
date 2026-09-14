import {
  BAR_PIP,
  checkersOn,
  OFF_PIP,
  parseMove,
  POINT_COUNT,
  type Position,
  type SideName,
} from "@repo/core";

import {
  BAR_CENTRE,
  BOTTOM,
  CHECKER_RADIUS,
  columnCentre,
  MAX_VISIBLE,
  MIDDLE,
  OFF_HEIGHT,
  offTop,
  pointPlace,
  stackCentre,
  TOP,
  TRAY_LEFT,
  TRAY_WIDTH,
} from "./geometry.ts";

interface Spot {
  x: number;
  y: number;
}

const HEAD_LENGTH = 3.6;
const HEAD_HALF_WIDTH = 2.2;

/** The shortest shaft worth drawing between two rims before an arrow starts from the middle instead. */
const MIN_SHAFT = 2;

/** Two decimals is far finer than anything visible, and keeps the markup short. */
const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * The `index`th checker out from the edge on one of the mover's stops — a
 * point in its own numbering, or `BAR_PIP` for its half of the bar. Past the
 * top of a drawn stack every checker shares the outermost slot, as it does in
 * `CheckerStack`.
 */
function checkerSpot(stop: number, index: number, turn: SideName): Spot {
  const slot = Math.max(0, Math.min(index, MAX_VISIBLE - 1));

  if (stop === BAR_PIP) {
    return { x: BAR_CENTRE, y: stackCentre(MIDDLE, turn === "player" ? 1 : -1, slot) };
  }

  const { column, row } = pointPlace(turn === "player" ? stop : POINT_COUNT + 1 - stop);
  return {
    x: columnCentre(column),
    y: row === "top" ? stackCentre(TOP, 1, slot) : stackCentre(BOTTOM, -1, slot),
  };
}

function traySpot(index: number, turn: SideName): Spot {
  return { x: TRAY_LEFT + TRAY_WIDTH / 2, y: offTop(turn === "player", index) + OFF_HEIGHT / 2 };
}

/** Which way a stack on one of the mover's stops grows on screen: 1 for down, -1 for up. */
function growth(stop: number, turn: SideName): 1 | -1 {
  const near = turn === "player";
  if (stop === BAR_PIP) return near ? 1 : -1;
  if (stop === OFF_PIP) return near ? -1 : 1;
  return pointPlace(near ? stop : POINT_COUNT + 1 - stop).row === "top" ? 1 : -1;
}

/**
 * A straight shaft from the rim of the checker at `start` — or its middle,
 * when the two checkers nearly touch — and a head whose tip stops `endGap`
 * short of `end`: the rim of a checker drawn there, or 0 for an empty spot.
 */
function arrowPaths(start: Spot, end: Spot, endGap: number): { shaft: string; head: string } {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const along = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };

  // Checkers on neighbouring points all but touch, which leaves no room for a
  // shaft between their rims. Those arrows start from the moving checker's
  // middle instead, so a one-pip move still reads as an arrow.
  const room = length - endGap - HEAD_LENGTH;
  const startGap = room >= CHECKER_RADIUS + MIN_SHAFT ? CHECKER_RADIUS : 0;
  const tail = { x: start.x + along.x * startGap, y: start.y + along.y * startGap };

  // The shaft stops at the head's base so the tip stays sharp.
  const tip = { x: end.x - along.x * endGap, y: end.y - along.y * endGap };
  const base = { x: tip.x - along.x * HEAD_LENGTH, y: tip.y - along.y * HEAD_LENGTH };
  const side = { x: -along.y * HEAD_HALF_WIDTH, y: along.x * HEAD_HALF_WIDTH };

  return {
    shaft: `M${round(tail.x)},${round(tail.y)} L${round(base.x)},${round(base.y)}`,
    head: `M${round(tip.x)},${round(tip.y)} L${round(base.x + side.x)},${round(base.y + side.y)} L${round(base.x - side.x)},${round(base.y - side.y)} Z`,
  };
}

interface MoveArrowsProps {
  move: string;
  position: Position;
  turn: SideName;
}

/**
 * One arrow per checker moved, from the top of the stack it leaves to the
 * slot it would fill. The stacks are replayed as the play goes, so two
 * checkers off the same point start from different checkers and land side by
 * side, and a hit lands on the blot it sends to the bar. A string that isn't
 * a play draws nothing.
 */
export function MoveArrows({ move, position, turn }: MoveArrowsProps) {
  const moves = parseMove(move);
  if (!moves) return null;

  const mover = position[turn];
  const stacks = [...mover.points];
  stacks[BAR_PIP] = mover.bar;
  let off = mover.off;

  const arrows: { shaft: string; head: string; hit: boolean }[] = [];

  for (let first = 0; first < moves.length;) {
    const { from, to } = moves[first]!;

    // Checkers making the same journey are drawn together as parallel arrows,
    // each leaving a different drawn checker, even off a stack taller than the
    // drawing. Between stacks growing the same way on screen, the outermost
    // checker leaving goes to the outermost slot filled; between stacks growing
    // opposite ways it goes to the innermost. Either way, no two arrows cross.
    let run = 1;
    while (moves[first + run]?.from === from && moves[first + run]?.to === to) run += 1;
    const hits = moves.slice(first, first + run).some(({ hit }) => hit);

    const leaving = Math.min(stacks[from] ?? 0, MAX_VISIBLE);
    const arriving = to === OFF_PIP ? off : (stacks[to] ?? 0);

    const sameWay = growth(from, turn) === growth(to, turn);

    // What the board draws at the destination before the play. A tray slot is
    // never taken, since borne-off checkers only ever arrive.
    const drawn = to === OFF_PIP ? 0 : Math.min(checkersOn(mover, to), MAX_VISIBLE);

    for (let step = 0; step < run; step++) {
      const start = checkerSpot(from, leaving - 1 - step, turn);
      const slot = sameWay ? arriving + run - 1 - step : arriving + step;
      const end = to === OFF_PIP ? traySpot(slot, turn) : checkerSpot(to, slot, turn);
      // The blot sat at the foot of the point, in the first slot filled.
      const hit = hits && slot === arriving;
      // An arrow landing on a drawn checker stops at its rim; one landing on
      // an empty spot points at the middle of it.
      const covered = hit || Math.min(slot, MAX_VISIBLE - 1) < drawn;
      arrows.push({ ...arrowPaths(start, end, covered ? CHECKER_RADIUS : 0), hit });
    }

    stacks[from] = (stacks[from] ?? 0) - run;
    if (to === OFF_PIP) off += run;
    else stacks[to] = arriving + run;
    first += run;
  }

  // Every casing goes down before any line, so where two arrows cross, one's
  // casing never cuts through the other.
  return (
    <g className="gammon-arrows">
      {(["casing", "line"] as const).map((layer) => (
        <g key={layer} className={`gammon-arrows--${layer}`}>
          {arrows.map(({ shaft, head, hit }, index) => (
            <g key={index} className={hit ? "gammon-arrow gammon-arrow--hit" : "gammon-arrow"}>
              <path className="gammon-arrow-shaft" d={shaft} />
              <path className="gammon-arrow-head" d={head} />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}
