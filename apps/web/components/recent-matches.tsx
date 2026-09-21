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
  RECENT_MATCHES,
  SEVERITY_COLOR,
  severityOf,
} from "@/lib/constants";
import { matchScoreOf } from "@/lib/score";
import { caller } from "@/server/caller";
import type { RecentBlunder, RecentMatch } from "@/server/router";

import { BlunderQuickView } from "./blunder-quick-view";

/** The board settings as the page read them, for the boards a line can open. */
interface BoardSettings {
  showPipCounts: boolean;
  flipBoard: boolean;
}

/**
 * Your newest matches, one at a time, each with every blunder you made in it.
 *
 * The rest of the page adds matches together, which is what lets it say
 * anything about form or leaks — and it is also why nothing else on it can say
 * what happened in the match you just finished.
 */
export async function RecentMatches(settings: BoardSettings) {
  const matches = await caller.overall.recentMatches();

  // One run of every line on the card, so a quick view steps from the end of one
  // match straight into the next the way the eye does.
  const rows = matches.flatMap(({ blunders }) => blunders);

  return (
    <Card
      title={`Last ${RECENT_MATCHES} matches`}
      // An `h2` for the same reason as the card beside it: a panel of the page.
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
              <Match match={match} rows={rows} {...settings} />
            </Fragment>
          ))}
        </Stack>
      )}
    </Card>
  );
}

interface MatchProps extends BoardSettings {
  match: RecentMatch;
  /** Every line on the card, for the quick view to step through. */
  rows: RecentBlunder[];
}

function Match({
  match: { finished_on, opponent, yours, theirs, blunders },
  rows,
  ...settings
}: MatchProps) {
  const equityLost = blunders.reduce((sum, blunder) => sum + blunder.error_magnitude, 0);

  return (
    <Stack ax="stretch" gap={2} fullwidth>
      <Group ax="space-between" ay="start" gap={4} fullwidth>
        <Stack gap={1}>
          <Group ay="baseline" gap={2}>
            {yours !== null && theirs !== null && (
              <Text weight="bold">{`${yours > theirs ? "Won" : "Lost"} ${yours}–${theirs}`}</Text>
            )}
            {opponent !== null && (
              <Text size={-1} shade="muted">
                vs {opponent}
              </Text>
            )}
          </Group>
          <Group ay="center" gap={2}>
            <CalendarIcon size={12} />
            <Text size={-1} shade="muted">
              {DAY.format(new Date(finished_on))}
            </Text>
          </Group>
        </Stack>
        {/* The two figures the rest of the page is made of, for this one match. */}
        <Group ay="baseline" gap={3}>
          <Text size={-1}>
            {blunders.length} {blunders.length === 1 ? "blunder" : "blunders"}
          </Text>
          <Text size={-1} weight="bold">
            <data value={equityLost}>{`−${equityLost.toFixed(3)}`}</data>
          </Text>
        </Group>
      </Group>

      <List marker="none" gap={2} fullwidth>
        {blunders.map((blunder) => (
          // A `both` blunder is two lines under one id, so the id alone isn't a key.
          <BlunderLine
            key={`${blunder.blunder_id}-${blunder.kind}`}
            blunder={blunder}
            rows={rows}
            {...settings}
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
function BlunderLine({
  blunder,
  rows,
  ...settings
}: Omit<MatchProps, "match"> & { blunder: RecentBlunder }) {
  const { kind, cube_action, error_magnitude, score_black, score_white, source_xgid, category } =
    blunder;

  const severity = severityOf(error_magnitude);
  const standing = matchScoreOf(score_black, score_white);

  return (
    <ListItem ay="center">
      <Group ay="center" gap={2}>
        <Badge color={SEVERITY_COLOR[severity]}>{error_magnitude.toFixed(3)}</Badge>
        <Text size={-1}>{categoryLabel(category)}</Text>
      </Group>
      <Group ay="center" gap={3}>
        <Text size={-1} shade="muted">
          {KIND_LABELS[kindCategory(kind, cube_action)]}
          {standing !== null && ` at ${standing.yours}–${standing.theirs}`}
        </Text>
        {/* Beside the quiz, as in the table: the same position, without the quiz. */}
        <Group ay="center" gap={1}>
          {source_xgid && (
            <BlunderQuickView
              blunder={blunder}
              rows={rows}
              startIndex={rows.indexOf(blunder)}
              {...settings}
            />
          )}
          <Button
            size="small"
            shape="square"
            variant="subtle"
            render={<Link href={blunderHref(category, blunder, "")} />}
            tooltip="Take blunder quiz"
            aria-label="Take blunder quiz"
          >
            <GraduationCapIcon />
          </Button>
        </Group>
      </Group>
    </ListItem>
  );
}
