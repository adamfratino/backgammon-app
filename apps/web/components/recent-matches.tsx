import { Fragment } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  Group,
  List,
  ListItem,
  Separator,
  Stack,
  Text,
} from "@uiid/design-system";
import { CalendarIcon, GraduationCapIcon } from "@uiid/design-system/icons";

import {
  blunderHref,
  categoryLabel,
  DAY,
  KIND_LABELS,
  kindCategory,
  matchSeverityOf,
  RECENT_MATCHES,
  SEVERITY_COLOR,
  severityOf,
} from "@/lib/constants";
import { matchScoreOf } from "@/lib/score";
import { caller } from "@/server/caller";
import type { RecentBlunder, RecentMatch } from "@/server/router";

import { BlunderQuickView } from "./blunder-quick-view";

/**
 * Your newest matches, one at a time, each with every blunder you made in it.
 *
 * The rest of the page adds matches together, which is what lets it say
 * anything about form or leaks — and it is also why nothing else on it can say
 * what happened in the match you just finished.
 */
export async function RecentMatches() {
  const matches = await caller.overall.recentMatches();

  const rows = matches.flatMap(({ blunders }) => blunders);

  return (
    <Card
      data-slot="recent-matches"
      title={`Last ${RECENT_MATCHES} matches`}
      TitleProps={{ render: <h2 /> }}
      description="Every blunder in each of your newest matches, in the order you made them."
    >
      {matches.length === 0 ? (
        <Text size={-1} shade="muted">
          No matches yet.
        </Text>
      ) : (
        <Stack ax="stretch" gap={4} mt={2} fullwidth>
          {matches.map((match, index) => (
            <Fragment key={match.match_id}>
              {index > 0 && <Separator />}
              <Match match={match} rows={rows} />
            </Fragment>
          ))}
        </Stack>
      )}
    </Card>
  );
}

interface MatchProps {
  match: RecentMatch;
  rows: RecentBlunder[];
}

function Match({ match: { finished_on, opponent, yours, theirs, blunders }, rows }: MatchProps) {
  const equityLost = blunders.reduce((sum, blunder) => sum + blunder.error_magnitude, 0);

  return (
    <Stack data-slot="match" ax="stretch" gap={2} fullwidth>
      <Group ax="space-between" ay="start" gap={4} fullwidth>
        <Stack gap={1}>
          <Group ay="center" gap={2}>
            {yours !== null && theirs !== null && (
              <Text weight="bold">{`${yours > theirs ? "Won" : "Lost"} ${yours}–${theirs}`}</Text>
            )}
            {opponent !== null && (
              <Text size={-1} shade="muted">
                vs {opponent}
              </Text>
            )}
            <Group ay="center" gap={2}>
              <CalendarIcon size={12} />
              <Text size={-1} shade="muted">
                {DAY.format(new Date(finished_on))}
              </Text>
            </Group>
          </Group>
        </Stack>
        <Group ay="center" gap={2}>
          <Badge color={SEVERITY_COLOR[matchSeverityOf("blunders", blunders.length)]}>
            {blunders.length} {blunders.length === 1 ? "blunder" : "blunders"}
          </Badge>
          <Badge color={SEVERITY_COLOR[matchSeverityOf("lost", equityLost)]}>
            <data value={equityLost}>{`−${equityLost.toFixed(3)}`}</data>
          </Badge>
        </Group>
      </Group>

      <List marker="none" fullwidth>
        {blunders.map((blunder) => (
          <BlunderLine
            // A `both` blunder is two lines under one id, so the id alone isn't a key.
            key={`${blunder.blunder_id}-${blunder.kind}`}
            blunder={blunder}
            rows={rows}
          />
        ))}
      </List>
    </Stack>
  );
}

/**
 * How badly, never what, as in the table: the position is the quiz, so the
 * line names where you went wrong and leaves what you played to the blunder's
 * own page.
 */
function BlunderLine({ blunder, rows }: Pick<MatchProps, "rows"> & { blunder: RecentBlunder }) {
  const { kind, cube_action, error_magnitude, score_black, score_white, source_xgid, category } =
    blunder;

  const severity = severityOf(error_magnitude);
  const standing = matchScoreOf(score_black, score_white);

  return (
    <ListItem data-slot="blunder-line" ay="center">
      <Group ay="center" gap={2}>
        <Badge color={SEVERITY_COLOR[severity]}>{error_magnitude.toFixed(3)}</Badge>
        <Link href={`/${category}`}>
          <Text size={-1}>{categoryLabel(category)}</Text>
        </Link>
      </Group>
      <Group ay="center" gap={3}>
        <Text size={-1} shade="muted">
          {KIND_LABELS[kindCategory(kind, cube_action)]}
          {standing !== null && ` at ${standing.yours}–${standing.theirs}`}
        </Text>
        <Group ay="center" gap={1}>
          {source_xgid && (
            <BlunderQuickView blunder={blunder} rows={rows} startIndex={rows.indexOf(blunder)} />
          )}
          <Button
            size="small"
            shape="square"
            variant="subtle"
            render={<Link href={blunderHref(category, blunder, "")} />}
            tooltip="Take blunder quiz"
          >
            <GraduationCapIcon />
          </Button>
        </Group>
      </Group>
    </ListItem>
  );
}
