import Link from "next/link";
// Named for what it does here rather than what the library calls it, the same
// way the statistics panel names its own — and so a reader never has to work
// out which of two `Progress` exports this is.
import { Progress as ShareBar } from "@microcharts/react/progress";
import {
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

import { categoryLabel } from "@/lib/constants";
import { caller } from "@/server/caller";
import type { Leak } from "@/server/router";

/** Wide enough to rank a column of rows by eye, narrow enough to stay a cell. */
const SHARE_BAR_WIDTH = 96;

/** A rule's worth of height — the bar is a length, not a shape. */
const SHARE_BAR_HEIGHT = 8;

/**
 * Where your equity actually goes, by category, across every match.
 *
 * The sidebar already counts these. What it cannot say is which of them costs
 * you anything: a count treats a 0.13 and a 0.45 as one mistake each, and the
 * two orders are not the same order.
 */
export async function LeaksTable() {
  const leaks = await caller.overall.leaks();

  const equityLost = leaks.reduce((sum, leak) => sum + leak.equityLost, 0);
  const decisions = leaks.reduce((sum, leak) => sum + leak.decisions, 0);

  // Ordered worst first by the query, so the scale every bar is drawn against
  // is the first row's total.
  const worst = leaks[0]?.equityLost ?? 0;

  return (
    <Stack ax="stretch" gap={4}>
      <Stack gap={1} maxw={560}>
        <Text render={<h2 />} size={1} weight="bold">
          Where the equity goes
        </Text>
        <Text size={-1} shade="muted">
          Ranked by what each category has cost in total, not by how often you go wrong there. A
          category can be a bigger leak than its count suggests when each mistake in it costs more —
          which is what the middle column is for. Across every category a mistake costs{" "}
          <data value={averageCost(equityLost, decisions)}>
            {averageCost(equityLost, decisions).toFixed(3)}
          </data>{" "}
          on average.
        </Text>
      </Stack>

      {leaks.length === 0 ? (
        <Text size={-1} shade="muted">
          No blunders yet.
        </Text>
      ) : (
        <TableContainer>
          <TableRoot striped highlightOnHover>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Mistakes</TableHead>
                <TableHead>Cost each</TableHead>
                <TableHead>Given up</TableHead>
                <TableHead>Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaks.map((leak) => (
                <LeakRow key={leak.category} leak={leak} worst={worst} />
              ))}
            </TableBody>
          </TableRoot>
        </TableContainer>
      )}
    </Stack>
  );
}

/** What one mistake costs on average, and zero where there are none to divide. */
function averageCost(equityLost: number, decisions: number): number {
  return decisions === 0 ? 0 : equityLost / decisions;
}

interface LeakRowProps {
  leak: Leak;
  /** The worst category's total, which is what every bar is drawn against. */
  worst: number;
}

function LeakRow({ leak: { category, decisions, equityLost, perDecision }, worst }: LeakRowProps) {
  return (
    <TableRow>
      <TableCell>
        {/* Straight to the category, carrying nothing: this page holds no
            filters and no sort for a link to take with it. */}
        <Link href={`/${category}`}>{categoryLabel(category)}</Link>
      </TableCell>
      <TableCell>
        <Text size={-1} shade="muted">
          <data value={decisions}>{decisions.toLocaleString()}</data>
        </Text>
      </TableCell>
      <TableCell>
        <Text size={-1}>
          <data value={perDecision}>{perDecision.toFixed(3)}</data>
        </Text>
      </TableCell>
      <TableCell>
        <Text size={-1} weight="bold">
          <data value={equityLost}>{`−${equityLost.toFixed(1)}`}</data>
        </Text>
      </TableCell>
      <TableCell>
        {/* Against the worst category rather than against the total, so the
            column uses its whole width: every share of a seventeen-way split is
            small, and bars drawn against the sum would all be stubs. */}
        <ShareBar
          value={equityLost}
          max={worst || 1}
          color="var(--mc-accent)"
          width={SHARE_BAR_WIDTH}
          height={SHARE_BAR_HEIGHT}
          label="none"
        />
      </TableCell>
    </TableRow>
  );
}
