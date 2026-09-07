import {
  checkersOn,
  pipCount,
  POINT_COUNT,
  type Cube,
  type Position,
  type SideName,
} from "@repo/core";

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
  MIDDLE,
  NEAR_HALF_CENTRE,
  OFF_HEIGHT,
  OFF_PITCH,
  PLAY_HEIGHT,
  PLAY_LEFT,
  PLAY_WIDTH,
  POINT_HEIGHT,
  POINT_WIDTH,
  TOP,
  topPoint,
  TRAY_LEFT,
  TRAY_WIDTH,
  WIDTH,
  HEIGHT,
} from "./geometry.ts";
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
  .gammon-numbers text {
    font: 500 4px ui-monospace, SFMono-Regular, Menlo, monospace;
    fill: #e8dcc4;
    pointer-events: none;
  }
`;

/** Beyond this a stack is taller than its point, so the total is written on it. */
const MAX_VISIBLE = 5;

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
}

function CheckerStack({ count, cx, edge, direction, side }: StackProps) {
  if (count <= 0) return null;

  const visible = Math.min(count, MAX_VISIBLE);
  const cy = (index: number) => edge + direction * (CHECKER_RADIUS + index * 2 * CHECKER_RADIUS);

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
          y={side === "player" ? BOTTOM - (index + 1) * OFF_PITCH : TOP + index * OFF_PITCH}
          width={TRAY_WIDTH - 2}
          height={OFF_HEIGHT}
          rx={0.6}
        />
      ))}
    </>
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

function Dice({ dice, turn }: { dice: [number, number]; turn: SideName }) {
  const centre = turn === "player" ? NEAR_HALF_CENTRE : FAR_HALF_CENTRE;
  const left = centre - (DIE_SIZE * 2 + DIE_GAP) / 2;

  return (
    <g className="gammon-dice">
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

/** Sits at its owner's end of the lane, or centred while nobody owns it. */
function DoublingCube({ cube }: { cube: Cube }) {
  const x = CUBE_LANE_LEFT + (CUBE_LANE_WIDTH - CUBE_SIZE) / 2;
  const y =
    cube.owner === "player"
      ? BOTTOM - CUBE_SIZE
      : cube.owner === "opponent"
        ? TOP
        : MIDDLE - CUBE_SIZE / 2;

  return (
    <g className="gammon-cube">
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
        textAnchor="middle"
        dominantBaseline="central"
      >
        {cube.value}
      </text>
    </g>
  );
}

/**
 * A backgammon position as a scalable SVG.
 *
 * The near side — `position.player`, drawn along the bottom — bears off at the
 * bottom right, so its points fall 12→1 across the bottom row and climb 13→24
 * across the top. The far side occupies the same triangles counting from the
 * other end. There is no state and no interactivity, so this renders on the
 * server and ships no JavaScript.
 */
export function Board({
  position,
  dice = null,
  cube = null,
  turn = "player",
  className,
  showNumbers = true,
}: BoardProps) {
  const { player, opponent } = position;

  const columns = Array.from({ length: COLUMNS }, (_, column) => column);

  // A centred cube still at 1 has never been turned. Drawing it would mean
  // putting a "1" on a face no real doubling cube has.
  const showCube = cube !== null && (cube.value > 1 || cube.owner !== null);

  const roll = dice ? `, rolling ${dice[0]}-${dice[1]}` : "";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      className={className}
    >
      <title>
        {`Backgammon position — near side ${pipCount(player)} pips, far side ${pipCount(opponent)} pips${roll}`}
      </title>
      <style>{DEFAULT_STYLES}</style>

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
      <rect className="gammon-tray" x={TRAY_LEFT} y={TOP} width={TRAY_WIDTH} height={PLAY_HEIGHT} />

      {dice ? <Dice dice={dice} turn={turn} /> : null}
      {showCube && cube ? <DoublingCube cube={cube} /> : null}

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
        />
        <CheckerStack
          count={opponent.bar}
          side="opponent"
          cx={BAR_CENTRE}
          edge={MIDDLE}
          direction={-1}
        />
      </g>

      <g className="gammon-trays">
        <Tray count={player.off} side="player" />
        <Tray count={opponent.off} side="opponent" />
      </g>

      {showNumbers ? (
        <g className="gammon-numbers">
          {columns.map((column) => (
            <text key={`top-${column}`} x={columnCentre(column)} y={TOP - 2} textAnchor="middle">
              {topPoint(column)}
            </text>
          ))}
          {columns.map((column) => (
            <text
              key={`bottom-${column}`}
              x={columnCentre(column)}
              y={BOTTOM + 5}
              textAnchor="middle"
            >
              {bottomPoint(column)}
            </text>
          ))}
        </g>
      ) : null}
    </svg>
  );
}
