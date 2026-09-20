import { cookies } from "next/headers";
import { Group, Stack, Text } from "@uiid/design-system";

import { BlunderFilterPanel } from "@/components/blunder-filters";
import { BlunderTable } from "@/components/blunder-table";
import {
  FLIP_BOARD_COOKIE,
  flipBoardFrom,
  PIP_COUNTS_COOKIE,
  pipCountsFrom,
} from "@/lib/board-settings";
import { categoryLabel } from "@/lib/constants";
import { caller } from "@/server/caller";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  // The Cube value track stops where the data does, and the panel is drawn here,
  // so the ceiling comes down as a prop rather than as a second round trip from
  // the browser.
  const [{ category }, topCubeValue, jar] = await Promise.all([
    params,
    caller.blunders.topCubeValue(),
    cookies(),
  ]);

  // A row's quick view draws its board in the browser, so it cannot read these
  // itself. Sent down from here, the board opens already matching the settings
  // rather than correcting itself once it is on screen.
  const showPipCounts = pipCountsFrom(jar.get(PIP_COUNTS_COOKIE)?.value);
  const flipBoard = flipBoardFrom(jar.get(FLIP_BOARD_COOKIE)?.value);

  // The title gets a row of its own above the table and the filters, rather than
  // sitting over either of them: it names both, and the topbar above it is kept
  // to the trail alone.
  return (
    <Stack fullwidth p={6} gap={6}>
      <Text render={<h1 />} size={3} weight="bold">
        {categoryLabel(category)}
      </Text>
      <Group ay="start" fullwidth gap={6}>
        {/* Takes whatever the sidebar leaves, and may shrink below its content. */}
        <Stack ax="stretch" minw={0} style={{ flex: 1 }}>
          <BlunderTable category={category} showPipCounts={showPipCounts} flipBoard={flipBoard} />
        </Stack>
        <BlunderFilterPanel category={category} topCubeValue={topCubeValue} />
      </Group>
    </Stack>
  );
}
