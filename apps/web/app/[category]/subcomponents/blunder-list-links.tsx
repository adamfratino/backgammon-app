import Link from "next/link";
import { List, ListItem, Text } from "@uiid/design-system";

import type { Blunder } from "@/server/router";

interface BlunderListLinkProps {
  blunders: Blunder[];
  category: string;
  selected: string | null;
  query: string;
}

export function BlunderListLinks({ blunders, category, selected, query }: BlunderListLinkProps) {
  return (
    <List gap={1}>
      {blunders.map(({ blunder_id, error_magnitude, played_notation, cube_action, kind }) => (
        <ListItem key={blunder_id}>
          <Text
            shade="muted"
            render={
              <Link
                href={`/${category}/${blunder_id}${query}`}
                aria-current={String(blunder_id) === selected ? "page" : undefined}
              />
            }
          >
            [{error_magnitude.toFixed(3)}] {played_notation ? `${played_notation}` : null}{" "}
            {kind !== "checker" ? cube_action : null}
          </Text>
        </ListItem>
      ))}
    </List>
  );
}
