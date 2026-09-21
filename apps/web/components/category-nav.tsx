import { Stack, Group, Separator, type StackProps, Text } from "@uiid/design-system";
import { TentTreeIcon } from "@uiid/design-system/icons";

import { caller } from "@/server/caller";
import { SIDEBAR_MINWIDTH } from "@/lib/constants";

import { CategoryCounts } from "./category-counts";

const OUTER_GAP: StackProps["gap"] = 6;

export function CategoryNav() {
  return (
    <CategoryContainer>
      <CategoryTitle />
      <Separator />
      <CategoryList />
    </CategoryContainer>
  );
}

const CategoryContainer = ({ children }: { children: React.ReactNode }) => (
  <Stack
    render={<nav />}
    aria-label="Blunder categories"
    gap={OUTER_GAP}
    minw={SIDEBAR_MINWIDTH}
    ax="stretch"
  >
    {children}
  </Stack>
);

const CategoryTitle = () => (
  <Text render={<Group gap={3} ay="start" render={<h2 />} />} size={3} weight="bold">
    <TentTreeIcon aria-label="A tent with a tree" size={30} /> &middot; Gammon &middot; Camp
    &middot;
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
