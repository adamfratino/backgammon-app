import { Stack, type StackProps, Text } from "@uiid/design-system";

import { caller } from "@/server/caller";
import { SIDEBAR_MINWIDTH } from "@/lib/constants";

import { CategoryCounts } from "./category-counts";

const OUTER_PADDING: StackProps["p"] = 0;
const OUTER_GAP: StackProps["gap"] = 6;

export function CategoryNav() {
  return (
    <CategoryContainer>
      <CategoryTitle />
      <CategoryList />
    </CategoryContainer>
  );
}

const CategoryContainer = ({ children }: { children: React.ReactNode }) => (
  <Stack
    render={<nav />}
    aria-label="Blunder categories"
    p={OUTER_PADDING}
    gap={OUTER_GAP}
    minw={SIDEBAR_MINWIDTH}
    ax="stretch"
  >
    {children}
  </Stack>
);

const CategoryTitle = () => (
  <Text render={<h2 />} size={1} weight="bold">
    Select a category
  </Text>
);

/**
 * Asked for with nothing narrowed, which is every category's total. The server
 * has no URL to read filters from — layouts are not given `searchParams`, and
 * this one is the root's — so the counting is the browser's job from here.
 */
const CategoryList = async () => {
  const categories = await caller.categories.list({});
  return <CategoryCounts categories={categories} />;
};
