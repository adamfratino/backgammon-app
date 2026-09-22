import Link from "next/link";
import { Text, ListItem, type ListItemProps } from "@uiid/design-system";

export interface SidebarLinkProps extends Omit<ListItemProps, "render"> {
  href: string;
  label: React.ReactNode;
  /** Whether this is the page you're on. */
  active?: boolean;
}

/**
 * A row in a sidebar section. The list item is the link, rather than a link
 * sitting inside it, so the whole row answers to a click. The label leads the
 * row and `children`, such as a badge, sit at its far end.
 */
export function SidebarLink({
  href,
  label,
  active = false,
  style,
  children,
  ...props
}: SidebarLinkProps) {
  return (
    <ListItem
      render={<Link href={href} />}
      aria-current={active ? "page" : undefined}
      ay="center"
      gap={4}
      style={{ ...style, textDecoration: "none" }}
      {...props}
    >
      <Text weight={active ? "bold" : undefined} shade={active ? "muted" : undefined}>
        {label}
      </Text>
      {children}
    </ListItem>
  );
}
