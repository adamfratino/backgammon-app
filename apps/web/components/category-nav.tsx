import { Stack, type StackProps, Text, List, ListItem, Badge } from "@uiid/design-system";
import { caller } from "@/server/caller";

import { CategoryLink } from "./category-link";

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
  <Stack render={<nav />} aria-label="Blunder categories" p={OUTER_PADDING} gap={OUTER_GAP}>
    {children}
  </Stack>
);

const CategoryTitle = () => (
  <Text render={<h2 />} size={1} weight="bold">
    Select a category
  </Text>
);

const CategoryList = async () => {
  const categories = await caller.categories.list();
  return (
    <List gap={1}>
      {categories.map(({ category, count }) => (
        <ListItem key={category}>
          <CategoryLink category={category}>
            <Text>{category}</Text>
            <Badge size="small" color="neutral">
              <data value={count}>{count}</data>
            </Badge>
          </CategoryLink>
        </ListItem>
      ))}
    </List>
  );
};
