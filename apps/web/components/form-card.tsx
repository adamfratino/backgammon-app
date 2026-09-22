import { Card, Text } from "@uiid/design-system";
import { Delta } from "@microcharts/react/delta";
import { TrendBars } from "./trend-bars";

interface FormCardProps {
  label: string;
  description: string;
  decimals: number;
  window: number;
  value: number;
  /** The window before this one, or null when there has not been a second yet. */
  previous: number | null;
  series: number[];
}

export function FormCard({
  label,
  description,
  decimals,
  window,
  value,
  previous,
  series,
}: FormCardProps) {
  return (
    <Card
      title={label}
      description={description}
      footer={
        // One `Text` around the whole sentence, because the footer is a flex row
        // and would otherwise lay the value, the chip and the words out as
        // separate items, dropping the spaces between them.
        <Text>
          <Text weight="bold">
            <data value={value}>{value.toFixed(decimals)}</data>
          </Text>{" "}
          now
          {previous !== null && (
            <>
              ,{" "}
              {/* Every measure here counts something that went wrong, so down is
                  the good direction on both — which is the one thing `Delta`
                  needs told, since it colours by valence and not by sign. */}
              <Delta value={value} from={previous} positive="down" /> against the previous {window}
            </>
          )}
        </Text>
      }
    >
      <TrendBars label={label} series={series} decimals={decimals} />
    </Card>
  );
}
