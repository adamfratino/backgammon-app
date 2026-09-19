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
 */
export function CubeIcon({ value, ...props }: CubeIconProps) {
  const face = String(value);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1.5em"
      height="1.5em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      role="img"
      aria-label={`Cube at ${face}`}
      {...props}
    >
      <rect x={2.5} y={2.5} width={19} height={19} rx={4} />
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
