"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, Group, List, ListItem, Pagination, Stack, Status, Text } from "@uiid/design-system";

import {
  type BlunderSeverity,
  categoryLabel,
  leakRamp,
  PAGE_SPREAD,
  RECENT_DECISIONS,
  SEVERITY_BANDS,
  SEVERITY_COLOR,
  severityOf,
} from "@/lib/constants";
import type { Leak } from "@/server/router";

import { ShareBar } from "./leaks-sharebar";

/** Lines a page of the legend holds. */
const PER_PAGE = 5;

/**
 * The card itself, on the client because its footer pages the legend: the page
 * it is on is read by the list and set by the pagination under it.
 */
export function LeaksCard({ leaks }: { leaks: Leak[] }) {
  const [page, setPage] = useState(1);

  const equityLost = leaks.reduce((sum, leak) => sum + leak.equityLost, 0);

  // Worst first out of the query, which the bar and the list under it both read
  // in that one order.
  const data = leaks.map((leak) => ({
    label: categoryLabel(leak.category),
    value: leak.equityLost,
  }));
  const colors = leakRamp(leaks.length);

  // The bar keeps every segment; only the legend is paged.
  const pageCount = Math.ceil(leaks.length / PER_PAGE);
  const start = (page - 1) * PER_PAGE;

  return (
    <Card
      title="Where the equity goes"
      TitleProps={{ render: <h2 /> }}
      description={`Ranked by what each category has cost in total, not by how often you go wrong there. The dots are each one's last ${RECENT_DECISIONS} mistakes, newest first.`}
      footer={
        pageCount > 1 && (
          <Pagination
            totalPages={pageCount}
            page={page}
            onPageChange={setPage}
            spread={PAGE_SPREAD}
          />
        )
      }
    >
      {leaks.length === 0 ? (
        <Text size={-1} shade="muted">
          No blunders yet.
        </Text>
      ) : (
        <Stack ax="stretch" gap={4} mt={2} fullwidth>
          <ShareBar data={data} maxSegments={leaks.length} colors={colors} />
          <Legend
            leaks={leaks.slice(start, start + PER_PAGE)}
            colors={colors.slice(start, start + PER_PAGE)}
            total={equityLost}
            rows={pageCount > 1 ? PER_PAGE : 0}
          />
        </Stack>
      )}
    </Card>
  );
}

interface LegendProps {
  leaks: Leak[];
  /** One per leak, in the same order — the colour that leak wears in the bar. */
  colors: string[];
  /** Every category's equity added up, which each line's share is taken of. */
  total: number;
  /** The fewest lines the list stands as tall as, blank ones making up the rest. */
  rows: number;
}

/**
 * Which segment is which, and what each one is worth.
 *
 * A small list rather than the five-column table this replaced: the bar above it
 * already ranks them, so a line only has to name its segment and carry the three
 * figures worth keeping.
 */
function Legend({ leaks, colors, total, rows }: LegendProps) {
  return (
    <List marker="none" gap={2} fullwidth>
      {leaks.map((leak, index) => (
        <LeakLine key={leak.category} leak={leak} color={colors[index]!} total={total} />
      ))}
      {/* The short last page keeps a full page's height, so the pagination
          under it stays where the pointer left it. */}
      {Array.from({ length: Math.max(0, rows - leaks.length) }, (_, index) => (
        <ListItem key={index} aria-hidden>
          &nbsp;
        </ListItem>
      ))}
    </List>
  );
}

interface LeakLineProps {
  leak: Leak;
  color: string;
  total: number;
}

function LeakLine({
  leak: { category, equityLost, perDecision, recent },
  color,
  total,
}: LeakLineProps) {
  return (
    // A list item lays its children out apart, so the name takes the left and
    // the figures the right with nothing here having to place them.
    <ListItem ay="center">
      <Group ay="center" gap={2}>
        {/* The tie back to the bar, and the whole of what a swatch does.
            `aria-hidden` because it says "this line is that segment" to a reader
            who can see both, and nothing at all to one who cannot. */}
        <span
          aria-hidden
          style={{ background: color, borderRadius: 2, height: "0.625rem", width: "0.625rem" }}
        />
        {/* Straight to the category, carrying nothing: this page holds no
            filters and no sort for a link to take with it. */}
        <Link href={`/${category}`}>
          <Text size={-1}>{categoryLabel(category)}</Text>
        </Link>
      </Group>
      <Group ay="center" gap={4}>
        <Group ay="baseline" gap={3}>
          <Text size={-1}>{share(equityLost, total)}</Text>
          <Text size={-1} weight="bold">
            <data value={equityLost}>{`−${equityLost.toFixed(1)}`}</data>
          </Text>
          <Text size={-1} shade="muted">
            <data value={perDecision}>{perDecision.toFixed(3)}</data> each
          </Text>
        </Group>
        <RecentSeverities recent={recent} />
      </Group>
    </ListItem>
  );
}

/**
 * The category's latest mistakes, one dot each in its severity's colour — the
 * fill the table's severity tracks are drawn in.
 *
 * Newest on the left, in the order the category's Newest sort lists them, so
 * the dots read across the way that table reads down.
 */
function RecentSeverities({ recent }: { recent: number[] }) {
  const severities = recent.map(severityOf);
  const label = recentLabel(severities);

  return (
    <Group role="img" aria-label={label} title={label} ay="center" gap={1}>
      {severities.map((severity, index) => (
        <Status key={index} color={SEVERITY_COLOR[severity]} />
      ))}
    </Group>
  );
}

/** "Last 10: 1 severe, 4 moderate, 5 mild" — worst first, empty bands left out. */
function recentLabel(severities: BlunderSeverity[]): string {
  const counts = SEVERITY_BANDS.map(({ id, label }) => ({
    label,
    count: severities.filter((severity) => severity === id).length,
  }))
    .filter(({ count }) => count > 0)
    .map(({ label, count }) => `${count} ${label.toLowerCase()}`);

  return `Last ${severities.length}: ${counts.join(", ")}`;
}

/**
 * A category's cut of the total, to a tenth of a percent.
 *
 * Whole percents would print the bottom four categories as 2%, 1%, 1% and 0% —
 * and a line that says a category costs you nothing is the one thing the number
 * is there to disprove.
 */
function share(equityLost: number, total: number): string {
  return total === 0 ? "0%" : `${((equityLost / total) * 100).toFixed(1)}%`;
}
