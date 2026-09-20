import { Group, Stack } from "@uiid/design-system";

import { BlunderFilterPanel } from "@/components/blunder-filters";
import { BlunderTable } from "@/components/blunder-table";
import { caller } from "@/server/caller";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  // The Cube value track stops where the data does, and the panel is drawn here,
  // so the ceiling comes down as a prop rather than as a second round trip from
  // the browser.
  const [{ category }, topCubeValue] = await Promise.all([params, caller.blunders.topCubeValue()]);

  return (
    <Group ay="start" fullwidth p={6} gap={6}>
      {/* Takes whatever the sidebar leaves, and may shrink below its content. */}
      <Stack ax="stretch" minw={0} style={{ flex: 1 }}>
        <BlunderTable category={category} />
      </Stack>
      <BlunderFilterPanel category={category} topCubeValue={topCubeValue} />
    </Group>
  );
}
