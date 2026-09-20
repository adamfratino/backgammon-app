import { checkersOn, POINT_COUNT, type Cube, type Position, type SideName } from "@repo/core";

import {
  BAR_CENTRE,
  BAR_LEFT,
  BAR_WIDTH,
  BOTTOM,
  bottomPoint,
  CHECKER_RADIUS,
  columnCentre,
  columnX,
  COLUMNS,
  CUBE_LANE_LEFT,
  CUBE_LANE_WIDTH,
  CUBE_SIZE,
  DIE_GAP,
  DIE_SIZE,
  FAR_HALF_CENTRE,
  FRAME,
  MAX_VISIBLE,
  MIDDLE,
  MIRROR,
  NEAR_HALF_CENTRE,
  OFF_HEIGHT,
  offTop,
  PIP_CHIP_HEIGHT,
  PLAY_HEIGHT,
  PLAY_LEFT,
  PLAY_WIDTH,
  POINT_HEIGHT,
  POINT_WIDTH,
  stackCentre,
  TOP,
  topPoint,
  TRAY_LEFT,
  TRAY_WIDTH,
  unmirror,
  WIDTH,
  HEIGHT,
} from "./geometry.ts";
import { MoveArrows } from "./MoveArrows.tsx";
import type { BoardProps } from "./types.ts";

/**
 * Sensible defaults, overridable through the `className` prop and the cascade.
 * Every selector is prefixed, because an SVG `<style>` inlined into an HTML
 * document is scoped to that document rather than to the diagram.
 */
const DEFAULT_STYLES = `
  .gammon-frame             { fill: #6b4423; }
  .gammon-surface           { fill: #d9c9a3; }
  .gammon-bar               { fill: #5c3a1e; }
  .gammon-tray              { fill: #4a2f18; }
  .gammon-point--dark       { fill: #8b5a2b; }
  .gammon-point--light      { fill: #c8a97e; }
  .gammon-checker           { stroke-width: 0.5; }
  .gammon-checker--player   { fill: #f7f3ea; stroke: #2b2b2b; }
  .gammon-checker--opponent { fill: #2b2b2b; stroke: #f7f3ea; }
  .gammon-off--player       { fill: #f7f3ea; }
  .gammon-off--opponent     { fill: #2b2b2b; }
  .gammon-die               { fill: #f7f3ea; stroke: #2b2b2b; stroke-width: 0.4; }
  .gammon-die-pip           { fill: #2b2b2b; }
  .gammon-cube-body         { fill: #efe7d2; stroke: #2b2b2b; stroke-width: 0.4; }
  .gammon-cube-value {
    font: 700 4px ui-monospace, SFMono-Regular, Menlo, monospace;
    fill: #2b2b2b;
    pointer-events: none;
  }
  .gammon-count {
    font: 600 4.5px ui-monospace, SFMono-Regular, Menlo, monospace;
    pointer-events: none;
  }
  .gammon-count--player     { fill: #2b2b2b; }
  .gammon-count--opponent   { fill: #f7f3ea; }
  .gammon-pip-count-body--player    { fill: #f7f3ea; }
  .gammon-pip-count-body--opponent  { fill: #2b2b2b; }
  .gammon-pip-count-value {
    font: 600 4px ui-monospace, SFMono-Regular, Menlo, monospace;
    pointer-events: none;
  }
  .gammon-pip-count-value--player   { fill: #2b2b2b; }
  .gammon-pip-count-value--opponent { fill: #f7f3ea; }
  .gammon-numbers text {
    font: 500 4px ui-monospace, SFMono-Regular, Menlo, monospace;
    fill: #e8dcc4;
    pointer-events: none;
  }
  .gammon-arrows            { pointer-events: none; }
  .gammon-arrow-shaft       { fill: none; stroke-linecap: round; }
  .gammon-arrow-head        { stroke-linejoin: round; }
  .gammon-arrows--casing .gammon-arrow-shaft { stroke: #f7f3ea; stroke-width: 2.8; }
  .gammon-arrows--casing .gammon-arrow-head  { fill: #f7f3ea; stroke: #f7f3ea; stroke-width: 1.4; }
  .gammon-arrows--line .gammon-arrow-shaft   { stroke: #d62828; stroke-width: 1.4; }
  .gammon-arrows--line .gammon-arrow-head    { fill: #d62828; }
`;

/** Pip positions on a die face, as columns and rows of a three-by-three grid. */
const DIE_PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

/**
 * Which side holds a point, in the near side's numbering. The far side counts
 * from the other end, so its checkers on the same physical point are filed
 * under `25 - point`. A legal position never has both, and the near side wins
 * the tie if an illegal one turns up.
 */
function occupant(position: Position, point: number): { side: SideName; count: number } | null {
  const near = checkersOn(position.player, point);
  if (near > 0) return { side: "player", count: near };

  const far = checkersOn(position.opponent, POINT_COUNT + 1 - point);
  if (far > 0) return { side: "opponent", count: far };

  return null;
}

function pointPath(column: number, row: "top" | "bottom"): string {
  const x = columnX(column);
  const base = row === "top" ? TOP : BOTTOM;
  const tip = row === "top" ? TOP + POINT_HEIGHT : BOTTOM - POINT_HEIGHT;
  return `M${x},${base} L${x + POINT_WIDTH},${base} L${x + POINT_WIDTH / 2},${tip} Z`;
}

interface StackProps {
  count: number;
  cx: number;
  /** The edge the stack grows from, and which way it grows. */
  edge: number;
  direction: 1 | -1;
  side: SideName;
  flipped: boolean;
}

function CheckerStack({ count, cx, edge, direction, side, flipped }: StackProps) {
  if (count <= 0) return null;

  const visible = Math.min(count, MAX_VISIBLE);
  const cy = (index: number) => stackCentre(edge, direction, index);

  return (
    <>
      {Array.from({ length: visible }, (_, index) => (
        <circle
          key={index}
          className={`gammon-checker gammon-checker--${side}`}
          cx={cx}
          cy={cy(index)}
          r={CHECKER_RADIUS}
        />
      ))}
      {count > MAX_VISIBLE ? (
        // The stack has run out of point to grow along, so the outermost
        // checker carries the real total rather than the drawing quietly
        // under-reporting it.
        <text
          className={`gammon-count gammon-count--${side}`}
          x={cx}
          y={cy(visible - 1)}
          transform={flipped ? unmirror(cx) : undefined}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {count}
        </text>
      ) : null}
    </>
  );
}

/** Borne-off checkers lie flat in the tray, stacked in from the near edge. */
function Tray({ count, side }: { count: number; side: SideName }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <rect
          key={index}
          className={`gammon-off gammon-off--${side}`}
          x={TRAY_LEFT + 1}
          y={offTop(side === "player", index)}
          width={TRAY_WIDTH - 2}
          height={OFF_HEIGHT}
          rx={0.6}
        />
      ))}
    </>
  );
}

/** A side's pip count on a chip in its checker colours, in the frame at its end of the tray. */
function PipCount({ count, side, flipped }: { count: number; side: SideName; flipped: boolean }) {
  const y = (side === "player" ? BOTTOM : 0) + (FRAME - PIP_CHIP_HEIGHT) / 2;
  const cx = TRAY_LEFT + TRAY_WIDTH / 2;

  return (
    <g className={`gammon-pip-count gammon-pip-count--${side}`}>
      <rect
        className={`gammon-pip-count-body gammon-pip-count-body--${side}`}
        x={TRAY_LEFT}
        y={y}
        width={TRAY_WIDTH}
        height={PIP_CHIP_HEIGHT}
        rx={1}
      />
      <text
        className={`gammon-pip-count-value gammon-pip-count-value--${side}`}
        x={cx}
        y={y + PIP_CHIP_HEIGHT / 2}
        transform={flipped ? unmirror(cx) : undefined}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {count}
      </text>
    </g>
  );
}

function Die({ value, x, y }: { value: number; x: number; y: number }) {
  // Quarters of the face put the outer pips one quarter in from each edge and
  // the middle one dead centre.
  const step = DIE_SIZE / 4;

  return (
    <>
      <rect className="gammon-die" x={x} y={y} width={DIE_SIZE} height={DIE_SIZE} rx={1.4} />
      {(DIE_PIPS[value] ?? []).map(([column, row], index) => (
        <circle
          key={index}
          className="gammon-die-pip"
          cx={x + step * (column + 1)}
          cy={y + step * (row + 1)}
          r={0.9}
        />
      ))}
    </>
  );
}

/**
 * The roll, thrown into the half holding the roller's home board. On a flipped
 * board the pair turns back as a block rather than a die at a time: mirroring
 * each face on its own would leave them in each other's places, and a 4-1 would
 * read 1-4.
 */
function Dice({
  dice,
  turn,
  flipped,
}: {
  dice: [number, number];
  turn: SideName;
  flipped: boolean;
}) {
  const centre = turn === "player" ? NEAR_HALF_CENTRE : FAR_HALF_CENTRE;
  const left = centre - (DIE_SIZE * 2 + DIE_GAP) / 2;

  return (
    <g className="gammon-dice" transform={flipped ? unmirror(centre) : undefined}>
      {dice.map((value, index) => (
        <Die
          key={index}
          value={value}
          x={left + index * (DIE_SIZE + DIE_GAP)}
          y={MIDDLE - DIE_SIZE / 2}
        />
      ))}
    </g>
  );
}

/** The cube itself: a face with the stake written on it, drawn from its top left. */
function CubeFace({
  value,
  x,
  y,
  className,
  flipped,
}: {
  value: number;
  x: number;
  y: number;
  className: string;
  flipped: boolean;
}) {
  return (
    <g className={className}>
      <rect
        className="gammon-cube-body"
        x={x}
        y={y}
        width={CUBE_SIZE}
        height={CUBE_SIZE}
        rx={1.4}
      />
      <text
        className="gammon-cube-value"
        x={x + CUBE_SIZE / 2}
        y={y + CUBE_SIZE / 2}
        transform={flipped ? unmirror(x + CUBE_SIZE / 2) : undefined}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {value}
      </text>
    </g>
  );
}

/** Sits at its owner's end of the lane, or centred while nobody owns it. */
function DoublingCube({ cube, flipped }: { cube: Cube; flipped: boolean }) {
  const y =
    cube.owner === "player"
      ? BOTTOM - CUBE_SIZE
      : cube.owner === "opponent"
        ? TOP
        : MIDDLE - CUBE_SIZE / 2;

  return (
    <CubeFace
      className="gammon-cube"
      value={cube.value}
      x={CUBE_LANE_LEFT + (CUBE_LANE_WIDTH - CUBE_SIZE) / 2}
      y={y}
      flipped={flipped}
    />
  );
}

/**
 * A double waiting to be answered, drawn the way it is played: the cube turned
 * to its new face and pushed across into the half the answer is owed from —
 * where that side's dice would land, and the one part of the board that is
 * otherwise empty on a cube decision. It is the whole of what is happening in
 * the position, so it sits in the middle of the board rather than out in the
 * lane, which it only reaches once the double is taken.
 */
function OfferedCube({
  value,
  turn,
  flipped,
}: {
  value: number;
  turn: SideName;
  flipped: boolean;
}) {
  const centre = turn === "player" ? NEAR_HALF_CENTRE : FAR_HALF_CENTRE;

  return (
    <CubeFace
      className="gammon-cube gammon-cube--offered"
      value={value}
      x={centre - CUBE_SIZE / 2}
      y={MIDDLE - CUBE_SIZE / 2}
      flipped={flipped}
    />
  );
}

/**
 * A backgammon position as a scalable SVG.
 *
 * The near side — `position.player`, drawn along the bottom — bears off at the
 * bottom right, so its points fall 12→1 across the bottom row and climb 13→24
 * across the top, or the other way about with `flipped`. The far side occupies
 * the same triangles counting from the other end. There is no state and no
 * interactivity, so this renders on the server and ships no JavaScript.
 */
export function Board({
  position,
  dice = null,
  cube = null,
  doubleOffered = false,
  turn = "player",
  move = null,
  pipCounts = null,
  className,
  showNumbers = true,
  flipped = false,
}: BoardProps) {
  const { player, opponent } = position;

  const columns = Array.from({ length: COLUMNS }, (_, column) => column);

  // Doubling turns the cube to twice the face it was on, and that is the face
  // the offer is worth — so a 1 centred at the start of a game is offered as a
  // 2. Without a cube there is no face to turn, and a roll on the board means
  // the dice have been thrown, which only happens once the offer is settled.
  const offered = doubleOffered && cube !== null && dice === null ? cube.value * 2 : null;

  // A centred cube still at 1 has never been turned. Drawing it would mean
  // putting a "1" on a face no real doubling cube has. An offer takes the cube
  // out of the lane entirely, so the two are never drawn at once.
  const showCube = offered === null && cube !== null && (cube.value > 1 || cube.owner !== null);

  // A roll is written high first — 41, not 14 — and the XGID makes no promise
  // about the order the pair arrives in, so the diagram puts it in that order
  // itself, for the drawing and for the name alike.
  const highFirst = dice ? ([...dice].sort((a, b) => b - a) as [number, number]) : null;

  const roll = highFirst ? `, rolling ${highFirst[0]}-${highFirst[1]}` : "";
  const play = move ? `, playing ${move}` : "";

  // The cube in the lane is a standing state the position speaks for, but an
  // offer is an act someone has just taken, and it is the only thing a cube
  // decision has in place of a roll. A board that draws it has to say it.
  const offer = offered === null ? "" : `, doubled to ${offered}`;

  // Whose the cube is decides who may turn it next, so a name carrying only
  // the face would leave out half of what the drawing says. The two are never
  // both named: an offer takes the cube out of the lane.
  const stake =
    !showCube || cube === null
      ? ""
      : cube.owner === null
        ? `, cube at ${cube.value}, centred`
        : `, cube at ${cube.value}, held by the ${cube.owner === "player" ? "near" : "far"} side`;

  // The name describes what is drawn, so the counts are named only when they
  // are shown. Reading out a number the board is deliberately withholding
  // would hand the answer to a screen reader alone.
  const race = pipCounts
    ? ` — near side ${pipCounts.player} pips, far side ${pipCounts.opponent} pips`
    : "";

  // A <title> names the image for screen readers, but browsers also show it as
  // a tooltip after hovering the board. aria-label names it without the hover.
  const label = `Backgammon position${race}${stake}${offer}${roll}${play}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
      className={className}
    >
      <style>{DEFAULT_STYLES}</style>

      {/* One mirror turns the whole board around; the glyphs inside turn back. */}
      <g transform={flipped ? MIRROR : undefined}>
        <rect className="gammon-frame" x="0" y="0" width={WIDTH} height={HEIGHT} />
        <rect
          className="gammon-surface"
          x={PLAY_LEFT}
          y={TOP}
          width={PLAY_WIDTH}
          height={PLAY_HEIGHT}
        />

        <g className="gammon-points">
          {columns.map((column) =>
            (["top", "bottom"] as const).map((row) => {
              const point = row === "top" ? topPoint(column) : bottomPoint(column);
              // Adjacent points alternate, and a point is the opposite shade to
              // the one facing it across the board.
              const dark = (column + (row === "bottom" ? 1 : 0)) % 2 === 0;
              return (
                <path
                  key={`${row}-${column}`}
                  className={`gammon-point gammon-point--${dark ? "dark" : "light"} gammon-point-${point}`}
                  d={pointPath(column, row)}
                />
              );
            }),
          )}
        </g>

        <rect className="gammon-bar" x={BAR_LEFT} y={TOP} width={BAR_WIDTH} height={PLAY_HEIGHT} />
        <rect
          className="gammon-tray"
          x={TRAY_LEFT}
          y={TOP}
          width={TRAY_WIDTH}
          height={PLAY_HEIGHT}
        />

        {highFirst ? <Dice dice={highFirst} turn={turn} flipped={flipped} /> : null}
        {offered === null ? null : <OfferedCube value={offered} turn={turn} flipped={flipped} />}
        {showCube && cube ? <DoublingCube cube={cube} flipped={flipped} /> : null}

        <g className="gammon-checkers">
          {columns.map((column) =>
            (["top", "bottom"] as const).map((row) => {
              const point = row === "top" ? topPoint(column) : bottomPoint(column);
              const held = occupant(position, point);
              if (!held) return null;
              return (
                <CheckerStack
                  key={`${row}-${column}`}
                  count={held.count}
                  side={held.side}
                  cx={columnCentre(column)}
                  edge={row === "top" ? TOP : BOTTOM}
                  direction={row === "top" ? 1 : -1}
                  flipped={flipped}
                />
              );
            }),
          )}

          {/* Hit checkers wait on the bar, each side on its own half. */}
          <CheckerStack
            count={player.bar}
            side="player"
            cx={BAR_CENTRE}
            edge={MIDDLE}
            direction={1}
            flipped={flipped}
          />
          <CheckerStack
            count={opponent.bar}
            side="opponent"
            cx={BAR_CENTRE}
            edge={MIDDLE}
            direction={-1}
            flipped={flipped}
          />
        </g>

        <g className="gammon-trays">
          <Tray count={player.off} side="player" />
          <Tray count={opponent.off} side="opponent" />
        </g>

        {pipCounts ? (
          <g className="gammon-pip-counts">
            <PipCount count={pipCounts.player} side="player" flipped={flipped} />
            <PipCount count={pipCounts.opponent} side="opponent" flipped={flipped} />
          </g>
        ) : null}

        {move ? <MoveArrows move={move} position={position} turn={turn} /> : null}

        {showNumbers ? (
          <g className="gammon-numbers">
            {columns.map((column) => (
              <text
                key={`top-${column}`}
                x={columnCentre(column)}
                y={TOP - 2}
                transform={flipped ? unmirror(columnCentre(column)) : undefined}
                textAnchor="middle"
              >
                {topPoint(column)}
              </text>
            ))}
            {columns.map((column) => (
              <text
                key={`bottom-${column}`}
                x={columnCentre(column)}
                y={BOTTOM + 5}
                transform={flipped ? unmirror(columnCentre(column)) : undefined}
                textAnchor="middle"
              >
                {bottomPoint(column)}
              </text>
            ))}
          </g>
        ) : null}
      </g>
    </svg>
  );
}
