"use client";

import { Collapsible, Group, List, Text } from "@uiid/design-system";
import { ChevronRightIcon } from "@uiid/design-system/icons";

import { SPACING_SM } from "@/lib/constants";

/**
 * A titled group of sidebar links that folds away under its title. Its rows are
 * links rather than list items, so the list is laid out as a plain container: a
 * link cannot sit directly inside a `<ul>`.
 */
export function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible
      trigger={({ open }) => <Trigger active={open}>{title}</Trigger>}
      RootProps={{ defaultOpen: true, ax: "stretch" }}
      PanelProps={{ ax: "stretch" }}
      instant
    >
      <List render={<div />} gap={2} ml={SPACING_SM}>
        {children}
      </List>
    </Collapsible>
  );
}

const Trigger = ({ children, active }: { children: React.ReactNode; active?: boolean }) => (
  <Group gap={2} ay="center" fullwidth mb={2} style={{ cursor: "pointer" }}>
    <Text size={-1} weight="bold" shade="muted">
      {children}
    </Text>
    <ChevronRightIcon size={12} style={{ transform: active ? "rotate(90deg)" : undefined }} />
  </Group>
);
