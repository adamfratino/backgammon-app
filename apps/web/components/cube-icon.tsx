interface CubeIconProps extends React.SVGProps<SVGSVGElement> {
  /** The face the cube reads: 1 while it is centred, then 2, 4, 8, 16, 32, 64. */
  value: number;
}

/**
 * The doubling cube as an icon: a die-shaped face with the stake written on it.
 *
 * It is drawn on lucide's 24-unit grid in `currentColor`, like the icons the
 * design system ships, so it takes the colour of the text around it and scales
 * with it. A real cube reads 2, 4, 8, 16, 32 and 64 across its six faces. It
 * will draw a 1 as well — the centred cube nobody has turned — for a caller
 * that would rather show that state than leave the space blank.
 *
 * Its square and its stroke are lucide's dice, so the cube and the roll in the
 * next column of the blunder table read as one set rather than two unrelated
 * drawings.
 */
export function CubeIcon({ value, style, ...props }: CubeIconProps) {
  const face = String(value);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="2em"
      height="2em"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinejoin="round"
      role="img"
      aria-label={`Cube at ${face}`}
      // An inline svg sits on the text baseline, so the line box keeps the
      // font's descender below it and the cube's row in the blunder table
      // stands taller than the rest. A block box has no baseline to sit on.
      // The dice next to it get this from the flex `Group` they are drawn in.
      style={{ display: "block", ...style }}
      {...props}
    >
      {/* Lucide's own dice geometry, so the cube and the dice beside it in the
          blunder table are the same square. */}
      <rect x={3} y={3} width={18} height={18} rx={2} ry={2} />
      {/* Two digits have to fit the same face as one, so the larger stakes set
          in a smaller size rather than growing the cube. */}
      <text
        x={12}
        y={12}
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        stroke="none"
        fontSize={face.length > 1 ? 11 : 13}
        fontWeight={600}
      >
        {face}
      </text>
    </svg>
  );
}
