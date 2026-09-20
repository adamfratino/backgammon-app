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
import { tabFrom, categoryLabel } from "@/lib/constants";
import { caller } from "@/server/caller";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

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
    <Group ay="start" fullwidth>
      <Stack ax="stretch" minw={0} p={6} gap={6} style={{ flex: 1 }}>
        <Group ay="center" gap={3}>
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
      <Stack gap={6} bl={1} bb={1} p={6} style={{ position: "sticky", top: "calc(3rem + 1px)" }}>
        <BlunderFilterPanel
          category={category}
          topCubeValue={topCubeValue}
          longestMatch={longestMatch}
        />
      </Stack>
    </Group>
  );
}
