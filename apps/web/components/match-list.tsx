import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  type CardProps,
  Group,
  List,
  ListItem,
  Separator,
  Stack,
  type StackProps,
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
  SEVERITY_COLOR,
  severityOf,
  SPACING_LG,
  SPACING_SM,
  TARGET_ER,
  targetBandOf,
} from "@/lib/constants";
import { matchScoreOf } from "@/lib/score";
import type { Match, MatchBlunder } from "@/server/router";

import { QuickViewProvider, QuickViewTrigger } from "./blunder-quick-view";

interface MatchListProps extends StackProps {
  matches: Match[];
  CardProps?: MatchItemProps["CardProps"];
}

/**
 * Matches one at a time, each with its blunders in the order you made them —
 * the homepage's last few and the matches page's whole list draw the same rows.
 */
export function MatchList({ matches, CardProps, ...props }: MatchListProps) {
  // Every line on the list, so a quick view steps on into the next match rather
  // than stopping at the end of the one it was opened from.
  const rows = matches.flatMap(({ blunders }) => blunders);

  return (
    <QuickViewProvider rows={rows}>
      <Stack ax="stretch" gap={SPACING_LG} fullwidth {...props}>
        {matches.map((match) => (
          <MatchItem key={match.match_id} CardProps={CardProps} match={match} rows={rows} />
        ))}
      </Stack>
    </QuickViewProvider>
  );
}

interface MatchItemProps {
  match: Match;
  rows: MatchBlunder[];
  CardProps?: CardProps;
}

/**
 * The count and the equity are the lines listed under the match, so under a
 * filter they add up what the filter kept. The ER is always the whole match's.
 */
function MatchItem({ match, rows, CardProps }: MatchItemProps) {
  const { finished_on, yours, theirs, your_er, blunders } = match;
  const equityLost = blunders.reduce((sum, blunder) => sum + blunder.error_magnitude, 0);

  return (
    <Card
      data-slot="match"
      {...CardProps}
      ax="stretch"
      fullwidth
      InnerContainerProps={{ gap: SPACING_SM }}
    >
      <Group ax="space-between" ay="start" gap={4} fullwidth>
        <Stack gap={1}>
          <Group ay="center" gap={2}>
            {yours !== null && theirs !== null && (
              <Text weight="bold">{`${yours > theirs ? "Won" : "Lost"} ${yours}–${theirs}`}</Text>
            )}
            <Group ay="center" gap={2}>
              <CalendarIcon size={12} />
              <Text size={-1} shade="muted">
                {DAY.format(new Date(finished_on))}
              </Text>
            </Group>
          </Group>
        </Stack>
        <Group ay="center" gap={0.5}>
          <Badge color={SEVERITY_COLOR[matchSeverityOf("blunders", blunders.length)]}>
            {blunders.length} {blunders.length === 1 ? "blunder" : "blunders"}
          </Badge>
          <Badge color={SEVERITY_COLOR[matchSeverityOf("lost", equityLost)]}>
            <data value={equityLost}>{`−${equityLost.toFixed(3)}`}</data>
          </Badge>
          <Badge
            size="small"
            color={your_er === null ? undefined : targetBandOf(your_er, TARGET_ER, 1).color}
          >
            {your_er === null ? "ER —" : `${your_er.toFixed(1)} ER`}
          </Badge>
        </Group>
      </Group>

      <Separator />

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
    </Card>
  );
}

/**
 * How badly, never what, as in the table: the position is the quiz, so the
 * line names where you went wrong and leaves what you played to the blunder's
 * own page.
 */
function BlunderLine({ blunder, rows }: Pick<MatchItemProps, "rows"> & { blunder: MatchBlunder }) {
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
          {source_xgid && <QuickViewTrigger index={rows.indexOf(blunder)} />}
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
