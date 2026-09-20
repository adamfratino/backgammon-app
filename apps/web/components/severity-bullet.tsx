import { Bullet } from "@microcharts/react/bullet";

import {
  type BlunderSeverity,
  ERROR_TRACK_MAX,
  paletteVar,
  SEVERITY_COLOR,
  SEVERITY_THRESHOLDS,
} from "@/lib/constants";

/**
 * How bad one blunder was, drawn on the scale the severity bands divide.
 *
 * The badge beside it already names the number and the band. What it cannot say
 * is where in the band the number sits, or how two rows compare without reading
 * both figures — a 0.104 and a 0.198 are both Moderate and wear the same
 * colour. The track says it at a glance, and a column of them is readable down
 * the page in a way a column of figures is not.
 *
 * This is the one place a chart beats the design system outright: there is no
 * word-sized primitive, and a progress bar has no way to draw the thresholds
 * the value is being judged against.
 *
 * Quiz-safe by construction. It draws the error magnitude, which is already on
 * screen, and nothing about the play that was made or the one that should have
 * been — see the list payload, which deliberately carries neither.
 */
export function SeverityBullet({
  errorMagnitude,
  severity,
}: {
  errorMagnitude: number;
  severity: BlunderSeverity;
}) {
  return (
    <Bullet
      // Past the end of the track the mark would draw outside its own box. The
      // badge carries the exact figure, so clamping costs a pegged row nothing
      // but its last fraction of travel.
      value={Math.min(errorMagnitude, ERROR_TRACK_MAX)}
      bands={SEVERITY_THRESHOLDS}
      domain={[0, ERROR_TRACK_MAX]}
      color={paletteVar(SEVERITY_COLOR[severity])}
      label="none"
      width={72}
      height={12}
      title={`${errorMagnitude.toFixed(3)} equity, ${severity}`}
    />
  );
}
