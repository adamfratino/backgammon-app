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
import { tabFrom, categoryLabel, SPACING_LG, SPACING_SM } from "@/lib/constants";
import { caller } from "@/server/caller";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const topbarStyles: React.CSSProperties = { position: "sticky", top: "calc(3rem + 1px)" };

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ category }, query, topCubeValue, longestMatch, jar] = await Promise.all([
    params,
    searchParams,
    caller.blunders.topCubeValue(),
    caller.blunders.longestMatch(),
    cookies(),
  ]);

  const showPipCounts = pipCountsFrom(jar.get(PIP_COUNTS_COOKIE)?.value);
  const flipBoard = flipBoardFrom(jar.get(FLIP_BOARD_COOKIE)?.value);

  const tab = tabFrom(typeof query.tab === "string" ? query.tab : null);

  return (
    <Group data-slot="category-page" ay="start" fullwidth>
      <Stack ax="stretch" minw={0} p={SPACING_LG} gap={SPACING_LG} style={{ flex: 1 }}>
        <Group ay="center" gap={SPACING_SM}>
          <Text render={<h1 />} size={3} weight="bold">
            {categoryLabel(category)}
          </Text>
          <CategoryViewToggle category={category} />
        </Group>
        {tab === "statistics" ? (
          <BlunderStats category={category} />
        ) : (
          <BlunderTable category={category} showPipCounts={showPipCounts} flipBoard={flipBoard} />
        )}
      </Stack>
      <Stack gap={SPACING_LG} bl={1} bb={1} p={SPACING_LG} style={topbarStyles}>
        <BlunderFilterPanel
          category={category}
          topCubeValue={topCubeValue}
          longestMatch={longestMatch}
        />
      </Stack>
    </Group>
  );
}
