import { cookies } from "next/headers";
import { Group, Stack, Text } from "@uiid/design-system";

import { BlunderFilterPanel } from "@/components/blunder-filters";
import { BlunderStats } from "@/components/blunder-stats";
import { BlunderTable } from "@/components/blunder-table";
import { CategoryViewToggle } from "@/components/category-view";
import {
  FLIP_BOARD_COOKIE,
  flipBoardFrom,
  PIP_COUNTS_COOKIE,
  pipCountsFrom,
} from "@/lib/board-settings";
import { categoryLabel, tabFrom } from "@/lib/constants";
import { caller } from "@/server/caller";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  // The Cube value track and the Min. score field both stop where the data
  // does, and the panel is drawn here, so both ceilings come down as props
  // rather than as a second round trip from the browser.
  const [{ category }, query, topCubeValue, longestMatch, jar] = await Promise.all([
    params,
    searchParams,
    caller.blunders.topCubeValue(),
    caller.blunders.longestMatch(),
    cookies(),
  ]);

  // A row's quick view draws its board in the browser, so it cannot read these
  // itself. Sent down from here, the board opens already matching the settings
  // rather than correcting itself once it is on screen.
  const showPipCounts = pipCountsFrom(jar.get(PIP_COUNTS_COOKIE)?.value);
  const flipBoard = flipBoardFrom(jar.get(FLIP_BOARD_COOKIE)?.value);

  // A repeated `?tab=` arrives as an array, which is no tab asked for rather
  // than either of them — the same reading every other param gets.
  const tab = tabFrom(typeof query.tab === "string" ? query.tab : null);

  // The title gets a row of its own above the table and the filters, rather than
  // sitting over either of them: it names both, and the topbar above it is kept
  // to the trail alone. The switch rides that row, because what it changes is
  // what the whole page is showing rather than anything inside one half.
  return (
    <Stack fullwidth p={6} gap={6}>
      <Group ay="center" gap={3}>
        <Text render={<h1 />} size={3} weight="bold">
          {categoryLabel(category)}
        </Text>
        <CategoryViewToggle category={category} />
      </Group>
      <Group ay="start" fullwidth gap={6}>
        {/* Takes whatever the sidebar leaves, and may shrink below its content. */}
        <Stack ax="stretch" minw={0} style={{ flex: 1 }}>
          {/* Both halves stand in the same column, beside the filters that narrow
              both, and the half the URL does not ask for is never rendered at
              all — the choice is made here rather than in the browser, so a link
              to the statistics arrives as the statistics rather than as the rows
              with a correction after them. */}
          {tab === "statistics" ? (
            <BlunderStats category={category} />
          ) : (
            <BlunderTable category={category} showPipCounts={showPipCounts} flipBoard={flipBoard} />
          )}
        </Stack>
        <BlunderFilterPanel
          category={category}
          topCubeValue={topCubeValue}
          longestMatch={longestMatch}
        />
      </Group>
    </Stack>
  );
}
