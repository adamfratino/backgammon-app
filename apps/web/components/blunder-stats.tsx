"use client";

import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SegmentedBar } from "@microcharts/react/segmented-bar";
import {
  type PaletteColor,
  Group,
  Progress,
  Stack,
  Status,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRoot,
  TableRow,
  Text,
} from "@uiid/design-system";

import {
  CUBE_ERRORS,
  CUBE_PANELS,
  CUBE_TENDENCIES,
  type CubeDirection,
  filtersFrom,
  MIN_CHART_DECISIONS,
  paletteVar,
  SEVERITY_BANDS,
  SEVERITY_COLOR,
} from "@/lib/constants";
import { useTRPC } from "@/trpc/client";

/** One line of a stats table: what went wrong, how often, and what it cost. */
interface StatRow {
  id: string;
  label: string;
  color: PaletteColor;
  decisions: number;
  equityLost: number;
}

/**
 * What this category's mistakes cost, under the filters the table above is
 * already using.
 *
 * It reads the filters off the URL rather than taking them as props, the way
 * the table does, so the two can never be looking at different questions: there
 * is one address for a view, and everything on the page reads it.
 */
export function BlunderStats({ category }: { category: string }) {
  const trpc = useTRPC();

  const searchParams = useSearchParams();
  const filters = filtersFrom(searchParams);

  const { isPending, isPlaceholderData, error, data } = useQuery({
    ...trpc.blunders.stats.queryOptions({ category, ...filters }),
    placeholderData: keepPreviousData,
  });

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load stats: {error.message}</p>;

  const bands: StatRow[] = SEVERITY_BANDS.map(({ id, label }) => ({
    id,
    label,
    color: SEVERITY_COLOR[id],
    ...(data.bands[id] ?? { decisions: 0, equityLost: 0 }),
  }));

  const cubeRows = (side: CubeDirection): StatRow[] =>
    CUBE_ERRORS.filter((error) => error.side === side).map(({ id, label, color }) => ({
      id,
      label,
      color,
      ...(data.cube[id] ?? { decisions: 0, equityLost: 0 }),
    }));

  return (
    <Stack
      aria-busy={isPlaceholderData}
      style={{ opacity: isPlaceholderData ? 0.5 : 1 }}
      ax="stretch"
      gap={6}
      pt={6}
      bt={1}
    >
      <StatPanel
        title="Equity lost by error level"
        description="Where your equity goes by severity: a few catastrophes, or the steady drip of small mistakes?"
        denominator={data.decisions}
        rows={bands}
        shareTitle="Share of total equity lost"
        shareDescription="The widest segment is the level costing you the most."
      />

      {/* Side by side, as the two halves of one question: whether the cube is
          worth more or less to you than you think. Reading down one and then
          the other is what makes the comparison. */}
      <Group ay="start" fullwidth gap={6}>
        {(Object.keys(CUBE_PANELS) as CubeDirection[]).map((side) => {
          const rows = cubeRows(side);
          const { title, description } = CUBE_PANELS[side];

          return (
            <Stack key={side} ax="stretch" minw={0} style={{ flex: 1 }}>
              <StatPanel
                title={title}
                description={description}
                denominator={rows.reduce((sum, row) => sum + row.decisions, 0)}
                rows={rows}
                shareTitle={`Share of ${side === "offer" ? "doubling" : "take/pass"} equity lost`}
                shareDescription="Mostly warm means the cube is worth less to you than you think; mostly cool, more."
                legend="tendency"
              />
            </Stack>
          );
        })}
      </Group>
    </Stack>
  );
}

/**
 * One statistic: what it is, what it is counted over, the rows themselves, and
 * the share bar that reads them as a single composition.
 *
 * The denominator is on the panel rather than implied by it. The list above
 * shows one page of rows while these count every decision the filters leave,
 * frequently hundreds — and with nothing saying so, a summary sitting under
 * fifteen rows reads as a summary of those fifteen.
 */
function StatPanel({
  title,
  description,
  denominator,
  rows,
  shareTitle,
  shareDescription,
  legend,
}: {
  title: string;
  description: string;
  denominator: number;
  rows: StatRow[];
  shareTitle: string;
  shareDescription: string;
  legend?: "tendency";
}) {
  return (
    <Stack ax="stretch" gap={4}>
      <Stack gap={1}>
        <Text render={<h2 />} size={1} weight="bold">
          {title}
        </Text>
        <Text size={-1} shade="muted">
          {description} Across{" "}
          <data value={denominator}>
            {denominator.toLocaleString()} {denominator === 1 ? "decision" : "decisions"}
          </data>
          , not the page above.
        </Text>
      </Stack>

      {denominator < MIN_CHART_DECISIONS ? (
        <TooFew decisions={denominator} />
      ) : (
        <>
          <StatTable rows={rows} />
          <ShareBar title={shareTitle} description={shareDescription} rows={rows} legend={legend} />
        </>
      )}
    </Stack>
  );
}

/**
 * The rows themselves: a name in its own colour, how many decisions, what they
 * cost, and the cost drawn against the worst-paying row.
 *
 * Counts and equity side by side, because the two disagree and that
 * disagreement is the point. Across the database the 901 moderate decisions
 * give up 123.43 between them where the 81 catastrophic ones give up 45.28 —
 * the level that looks survivable one at a time is the one paying for the
 * matches. A column of counts alone is already on the Severity filter's badges,
 * and it tells the opposite story.
 *
 * Bars rather than a chart: there are a handful of rows with a name, a count
 * and a total apiece, which is a table. All the numbers need is something to be
 * read against, and a bar per row does that without turning them into a figure.
 */
function StatTable({ rows }: { rows: StatRow[] }) {
  // Relative to the worst-paying row rather than to the total, so the longest is
  // always full and the rest are read against it.
  const worst = Math.max(...rows.map(({ equityLost }) => equityLost));

  return (
    <TableContainer>
      <TableRoot>
        <TableHeader>
          <TableRow>
            <TableHead>Decision</TableHead>
            <TableHead>Count</TableHead>
            <TableHead>Equity</TableHead>
            <TableHead>
              <span className="sr-only">Cost against the worst row</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ id, label, color, decisions, equityLost }) => (
            <TableRow key={id}>
              <TableCell>
                <Status color={color}>{label}</Status>
              </TableCell>
              <TableCell>
                <Text size={-1}>{decisions.toLocaleString()}</Text>
              </TableCell>
              {/* Signed, because it is equity given up rather than equity held:
                  the column reads as a loss at a glance, the way it does on the
                  analysis it came from. */}
              <TableCell>
                <Text size={-1} weight="bold">
                  {equityLost === 0 ? "—" : `−${equityLost.toFixed(2)}`}
                </Text>
              </TableCell>
              <TableCell>
                <Progress
                  value={worst === 0 ? 0 : (equityLost / worst) * 100}
                  color={color}
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableRoot>
    </TableContainer>
  );
}

/**
 * The same rows as one bar, which answers the question the table cannot: not
 * what each row cost, but how the whole divides between them.
 *
 * This is the one thing here worth a chart. The rows above are numbers with
 * something to be read against, which a table and a bar do plainly; a
 * composition is a single shape, and reading proportion off four separate bars
 * means doing the addition yourself.
 *
 * Colours are handed in rather than themed, so a segment is the same hue as the
 * dot on its row — `paletteVar` names the token the palette class resolves to.
 */
function ShareBar({
  title,
  description,
  rows,
  legend,
}: {
  title: string;
  description: string;
  rows: StatRow[];
  legend?: "tendency";
}) {
  const segments = rows.filter(({ equityLost }) => equityLost > 0);
  if (segments.length < 2) return null;

  return (
    <Stack ax="stretch" gap={2}>
      <Stack gap={0}>
        <Text size={-1} weight="bold">
          {title}
        </Text>
        <Text size={-1} shade="muted">
          {description}
        </Text>
      </Stack>

      <SegmentedBar
        data={segments.map(({ label, equityLost }) => ({ label, value: equityLost }))}
        colors={segments.map(({ color }) => paletteVar(color))}
        order="data"
        // No figures on the bar. The percentages it can fit depend on how the
        // composition happens to divide — at this height most of them drop out
        // and the one that survives reads as the only one worth having. The
        // rows above carry the numbers; this carries the shape.
        label="none"
        height={16}
        title={title}
      />

      {/* The cube's two panels are read as a temperature, so their key names the
          lean rather than the mistake — the row above already named the
          mistake, and in its own colour. */}
      {legend === "tendency" && (
        <Group gap={4} ay="center">
          {CUBE_TENDENCIES.map(({ id, label }) => {
            const error = CUBE_ERRORS.find(
              (candidate) =>
                candidate.tendency === id && segments.some((s) => s.id === candidate.id),
            );
            if (!error) return null;

            return (
              <Status key={id} color={error.color}>
                {label}
              </Status>
            );
          })}
        </Group>
      )}
    </Stack>
  );
}

/**
 * What a panel says instead of a table of near-empty rows. Rows drawn from a
 * handful of decisions look exactly like rows drawn from hundreds, so the
 * honest thing is the count — and it sits where the table would have, so the
 * panel keeps its shape as you move between categories.
 */
function TooFew({ decisions }: { decisions: number }) {
  return (
    <Text size={-1} shade="muted">
      {decisions === 0
        ? "No decisions here to break down."
        : `Only ${decisions} ${decisions === 1 ? "decision" : "decisions"} here — too few to break down.`}
    </Text>
  );
}
