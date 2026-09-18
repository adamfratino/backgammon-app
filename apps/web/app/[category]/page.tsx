import { Stack } from "@uiid/design-system";

import { BlunderFilterPanel } from "./blunder-filters";
import { BlunderTable } from "./blunder-table";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

const GAP = 6;

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;

  return (
    <Stack ax="stretch" fullwidth p={GAP} gap={GAP}>
      <BlunderFilterPanel category={category} />
      <BlunderTable category={category} />
    </Stack>
  );
}
