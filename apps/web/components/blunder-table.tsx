"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Group,
  Stack,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRoot,
  TableRow,
  Text,
} from "@uiid/design-system";
import { CalendarIcon, GraduationCapIcon } from "@uiid/design-system/icons";

import type { Blunder } from "@/server/router";
import { BlunderQuickView } from "./blunder-quick-view";
import { CopyButton } from "./copy-button";
import { CubeIcon } from "./cube-icon";
import { DiceRoll } from "./dice-roll";
import { SeverityBullet } from "./severity-bullet";
import {
  blunderHref,
  filtersFrom,
  isFiltered,
  KIND_LABELS,
  kindCategory,
  pageFrom,
  PER_PAGE,
  SEVERITY_COLOR,
  severityOf,
  sortFrom,
  viewParams,
} from "@/lib/constants";
import { matchScoreOf } from "@/lib/score";
import { useTRPC } from "@/trpc/client";

import { BlunderTablePagination } from "./blunder-table-pagination";

interface BlunderTableProps {
  category: string;
  /** The pip-count setting as the server read it, for the boards a row can open. */
  showPipCounts: boolean;
  /** Which way round those boards face, read from its own cookie the same way. */
  flipBoard: boolean;
}

// Fixed locale and zone, so the server and the browser print the same day.
const DAY = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/**
 * One page of the category, in the order the server sorted it. Previous and Next
 * on a blunder walk the same rows in the same order, so what is below a row here
 * is what Next opens.
 */
export function BlunderTable({ category, showPipCounts, flipBoard }: BlunderTableProps) {
  const trpc = useTRPC();

  const searchParams = useSearchParams();
  const page = pageFrom(searchParams.get("page"));
  const filters = filtersFrom(searchParams);
  const sort = sortFrom(searchParams.get("sort"));

  // What every link out of this table has to carry to come back to this view.
  const params = viewParams(filters, sort);
  if (page > 1) params.set("page", String(page));
  const query = params.size > 0 ? `?${params}` : "";

  const { isPending, isPlaceholderData, error, data } = useQuery({
    ...trpc.blunders.byCategory.queryOptions({ category, page, ...filters, sort }),
    placeholderData: keepPreviousData,
  });

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.total === 0) {
    const blame = isFiltered(filters) ? "match these filters" : "in this category";
    return <p>No blunders {blame}.</p>;
  }

  const first = (page - 1) * PER_PAGE + 1;
  const last = first + data.blunders.length - 1;

  return (
    <Stack
      aria-busy={isPlaceholderData}
      style={{ opacity: isPlaceholderData ? 0.5 : 1 }}
      ax="stretch"
      gap={3}
    >
      <TableContainer>
        <TableRoot striped highlightOnHover>
          <TableHeader>
            <TableRow>
              <TableHead>Error</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type of play</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Cube</TableHead>
              <TableHead>Roll</TableHead>
              <TableHead>
                <span className="sr-only">Row actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.blunders.map((blunder, index) => (
              // A `both` blunder is two rows under one id, so the id alone isn't a key.
              <BlunderTableRow
                key={`${blunder.blunder_id}-${blunder.kind}`}
                blunder={blunder}
                href={blunderHref(category, blunder, query)}
                rows={data.blunders}
                index={index}
                showPipCounts={showPipCounts}
                flipBoard={flipBoard}
              />
            ))}
          </TableBody>
        </TableRoot>
      </TableContainer>

      <Group gap={2} fullwidth ax="space-between">
        <BlunderTablePagination
          page={page}
          total={data.total}
          category={category}
          filters={filters}
          sort={sort}
        />
        <Text shade="muted">
          Showing {first}–{last} of <data value={data.total}>{data.total}</data>
        </Text>
      </Group>
    </Stack>
  );
}

/**
 * How badly, never what: the position is the quiz, so neither the play that was
 * made nor the one that should have been leaves the blunder's own page.
 */
function BlunderTableRow({
  blunder,
  href,
  rows,
  index,
  showPipCounts,
  flipBoard,
}: {
  blunder: Blunder;
  href: string;
  /** The whole page, so the row's quick view can step through its neighbours. */
  rows: Blunder[];
  index: number;
  showPipCounts: boolean;
  flipBoard: boolean;
}) {
  const {
    kind,
    cube_action,
    die_1,
    die_2,
    error_magnitude,
    match_length,
    score_black,
    score_white,
    cube_value,
    finished_on,
    source_xgid,
  } = blunder;

  const severity = severityOf(error_magnitude);

  // Blunders without a match score have none of the three, never just one.
  // Your points first, as on the blunder page — see `matchScoreOf`.
  const standing = match_length === null ? null : matchScoreOf(score_black, score_white);
  const score = standing === null ? "—" : `${standing.yours}–${standing.theirs} to ${match_length}`;

  return (
    <TableRow>
      {/* The badge keeps the figure and the colour; the track beside it says
          where that figure sits on the scale the bands divide, which is the one
          thing neither the number nor the colour can show. */}
      <TableCell>
        <Group gap={2} ay="center">
          <Badge color={SEVERITY_COLOR[severity]}>{error_magnitude.toFixed(3)}</Badge>
          <SeverityBullet errorMagnitude={error_magnitude} severity={severity} />
        </Group>
      </TableCell>
      <TableCell>
        <Group gap={2} ay="center">
          <CalendarIcon size={12} />
          <Text size={-1}>{finished_on === null ? "—" : DAY.format(new Date(finished_on))}</Text>
        </Group>
      </TableCell>
      <TableCell>
        <Text size={-1} weight="bold">
          {KIND_LABELS[kindCategory(kind, cube_action)]}
        </Text>
      </TableCell>

      <TableCell>
        <Text size={-1} weight="bold">
          {score}
        </Text>
      </TableCell>
      {/* A cube still reading 1 was never turned, so the column stays empty until
          there is a stake to show — as on the board, where an unturned cube is
          left out rather than drawn with a face no real cube has. */}
      <TableCell>
        {cube_value !== null && cube_value > 1 ? <CubeIcon value={cube_value} /> : "—"}
      </TableCell>
      {/* A cube decision is made before the dice are thrown, so only a checker play has a roll. */}
      <TableCell>{kind === "checker" ? <DiceRoll die_1={die_1} die_2={die_2} /> : "—"}</TableCell>
      {/* View first, where it has always been; the XGID is the utility beside it.
          Copying a position takes the reader to XG, not to the blunder, so it
          stays the quieter of the two rather than competing for the same click.
          The eye between them opens the same position without the quiz, so it
          sits next to the quiz rather than next to the copy. */}
      <TableCell collapse>
        <Group gap={1} ay="center">
          {source_xgid && (
            <>
              <CopyButton value={source_xgid} label="Copy XGID" size="small" variant="subtle" />
              <BlunderQuickView
                blunder={blunder}
                rows={rows}
                startIndex={index}
                showPipCounts={showPipCounts}
                flipBoard={flipBoard}
              />
            </>
          )}
          <Button
            size="small"
            shape="square"
            variant="subtle"
            render={<Link href={href} />}
            tooltip="Take blunder quiz"
            aria-label="Take blunder quiz"
          >
            <GraduationCapIcon />
          </Button>
        </Group>
      </TableCell>
    </TableRow>
  );
}
