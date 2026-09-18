import { Group, Stack } from "@uiid/design-system";

import { BlunderFilterPanel } from "./blunder-filters";
import { BlunderTable } from "./blunder-table";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;

  return (
    <Group ay="start" fullwidth p={6} gap={6}>
      {/* Takes whatever the sidebar leaves, and may shrink below its content. */}
      <Stack ax="stretch" minw={0} style={{ flex: 1 }}>
        <BlunderTable category={category} />
      </Stack>
      <BlunderFilterPanel category={category} />
    </Group>
  );
}
