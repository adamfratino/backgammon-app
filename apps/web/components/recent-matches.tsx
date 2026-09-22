import Link from "next/link";
import { Button, Card, Text } from "@uiid/design-system";
import { TableIcon } from "@uiid/design-system/icons";

import { RECENT_MATCHES } from "@/lib/constants";
import { caller } from "@/server/caller";

import { MatchList } from "./match-list";

/**
 * Your newest matches, one at a time, each with every blunder you made in it.
 *
 * The rest of the page adds matches together, which is what lets it say
 * anything about form or leaks — and it is also why nothing else on it can say
 * what happened in the match you just finished.
 */
export async function RecentMatches() {
  const matches = await caller.overall.recentMatches();

  return (
    <Card
      data-slot="recent-matches"
      title={`Last ${RECENT_MATCHES} matches`}
      description="A brief timeline of the blunders you've recently made"
      TitleProps={{ render: <h2 />, style: { alignContent: "center" } }}
      action={
        <Button size="xsmall" variant="subtle" render={<Link href="/matches" />}>
          <TableIcon />
          View all
        </Button>
      }
    >
      {matches.length === 0 ? (
        <Text size={-1} shade="muted">
          No matches yet.
        </Text>
      ) : (
        <MatchList CardProps={{ variant: "ghost", p: 0 }} matches={matches} mt={2} />
      )}
    </Card>
  );
}
