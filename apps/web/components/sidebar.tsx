import { Stack, Group, Separator, type StackProps, Text } from "@uiid/design-system";
import { TentIcon } from "@uiid/design-system/icons";

import { caller } from "@/server/caller";
import { SIDEBAR_MINWIDTH } from "@/lib/constants";

import { CategoryCounts } from "./category-counts";
import { SidebarSection } from "./sidebar-section";

const OUTER_GAP: StackProps["gap"] = 6;

export function Sidebar() {
  return (
    <SidebarContainer>
      <SidebarTitle />
      <Separator />
      <SidebarSection title="Categories">
        <CategoryList />
      </SidebarSection>
    </SidebarContainer>
  );
}

const SidebarContainer = ({ children }: { children: React.ReactNode }) => (
  <Stack render={<nav />} aria-label="Sidebar" gap={OUTER_GAP} minw={SIDEBAR_MINWIDTH} ax="stretch">
    {children}
  </Stack>
);

const SidebarTitle = () => (
  <Text render={<Group gap={2} ay="start" render={<h2 />} />} size={3} weight="bold">
    <TentIcon aria-label="A tent with a tree" size={30} />
    &middot; Gammon &middot; Camp &middot;
  </Text>
);

const CategoryList = async () => {
  const categories = await caller.categories.list({});
  return <CategoryCounts categories={categories} />;
};
