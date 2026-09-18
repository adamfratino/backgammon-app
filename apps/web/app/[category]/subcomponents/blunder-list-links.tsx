import Link from "next/link";
import { List, ListItem, Text } from "@uiid/design-system";

import type { Blunder } from "@/server/router";
import { blunderHref, isOpen, type OpenBlunder } from "@/lib/constants";

interface BlunderListLinkProps {
  blunders: Blunder[];
  category: string;
  selected: OpenBlunder | null;
  query: string;
}

export function BlunderListLinks({ blunders, category, selected, query }: BlunderListLinkProps) {
  return (
    <List gap={1}>
      {blunders.map((blunder) => {
        const { blunder_id, error_magnitude, played_notation, cube_action, kind } = blunder;

        return (
          <ListItem key={blunder_id}>
            <Text
              shade="muted"
              render={
                <Link
                  href={blunderHref(category, blunder, query)}
                  aria-current={isOpen(blunder, selected) ? "page" : undefined}
                />
              }
            >
              [{error_magnitude.toFixed(3)}] {played_notation ? `${played_notation}` : null}{" "}
              {kind !== "checker" ? cube_action : null}
            </Text>
          </ListItem>
        );
      })}
    </List>
  );
}
