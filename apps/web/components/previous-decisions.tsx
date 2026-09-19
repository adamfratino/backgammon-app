import { Stack, Text } from "@uiid/design-system";
import { severityOf } from "@/lib/constants";
import type { BlunderDetail } from "@/lib/analysis.types";

interface PreviousDecisionsProps extends Pick<BlunderDetail, "decisions"> {}

export function PreviousDecisions({ decisions }: PreviousDecisionsProps) {
  return (
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
  );
}
