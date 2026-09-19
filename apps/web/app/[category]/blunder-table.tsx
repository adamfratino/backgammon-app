"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Group,
  type PaletteColor,
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
import { EyeIcon } from "@uiid/design-system/icons";

import type { Blunder } from "@/server/router";
import {
  type BlunderSeverity,
  blunderHref,
  filtersFrom,
  KIND_LABELS,
  kindCategory,
  pageFrom,
  PER_PAGE,
  severityOf,
  sortFrom,
  viewParams,
} from "@/lib/constants";
import { useTRPC } from "@/trpc/client";

import { roll } from "./analysis.utils";
import { BlunderTablePagination } from "./subcomponents/blunder-table-pagination";

interface BlunderTableProps {
  category: string;
}

// Fixed locale and zone, so the server and the browser print the same day.
const DAY = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/**
 * One page of the category, in the order the server sorted it. Previous and Next
 * on a blunder walk the same rows in the same order, so what is below a row here
 * is what Next opens.
 */
export function BlunderTable({ category }: BlunderTableProps) {
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
    const filtered = Object.values(filters).some(({ length }) => length > 0);
    return <p>{filtered ? "No blunders match these filters." : "No blunders in this category."}</p>;
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
              <TableHead>Kind</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Cube</TableHead>
              <TableHead>Roll</TableHead>
              <TableHead>
                <span className="sr-only">Row actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.blunders.map((blunder) => (
              // A `both` blunder is two rows under one id, so the id alone isn't a key.
              <BlunderTableRow
                key={`${blunder.blunder_id}-${blunder.kind}`}
                blunder={blunder}
                href={blunderHref(category, blunder, query)}
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

// No green: no blunder is fine, so even the mildest band stays neutral.
const SEVERITY_COLOR: Record<BlunderSeverity, PaletteColor> = {
  catastrophic: "red",
  severe: "orange",
  moderate: "yellow",
  mild: "neutral",
};

/**
 * How badly, never what: the position is the quiz, so neither the play that was
 * made nor the one that should have been leaves the blunder's own page.
 */
function BlunderTableRow({ blunder, href }: { blunder: Blunder; href: string }) {
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
  } = blunder;

  // Blunders without a match score have none of the three, never just one.
  const score =
    match_length === null || score_black === null || score_white === null
      ? "—"
      : `${score_black}–${score_white} to ${match_length}`;

  return (
    <TableRow>
      <TableCell>
        <Badge color={SEVERITY_COLOR[severityOf(error_magnitude)]}>
          {error_magnitude.toFixed(3)}
        </Badge>
      </TableCell>
      <TableCell>{KIND_LABELS[kindCategory(kind, cube_action)]}</TableCell>
      <TableCell>{finished_on === null ? "—" : DAY.format(new Date(finished_on))}</TableCell>
      <TableCell>{score}</TableCell>
      <TableCell>{cube_value ?? "—"}</TableCell>
      {/* A cube decision is made before the dice are thrown, so only a checker play has a roll. */}
      <TableCell>{kind === "checker" ? roll(die_1, die_2) : "—"}</TableCell>
      <TableCell collapse>
        <Button
          size="xsmall"
          variant="subtle"
          render={<Link href={href} />}
          tooltip="View blunder"
          aria-label="View blunder"
        >
          <EyeIcon />
        </Button>
      </TableCell>
    </TableRow>
  );
}
