import { Stack, Text } from "@uiid/design-system";

import type { Blunder, BucketCount } from "@/server/router";
import {
  CUBE_DIRECTIONS,
  KINDS,
  SEVERITY_BANDS,
  severityOf,
  cubeDirection,
  type BlunderKind,
  type OpenBlunder,
} from "@/lib/constants";

import { BlunderListLinks } from "./blunder-list-links";

interface BlunderListGroup {
  id: string;
  label: string;
  blunders: Blunder[];
  total: number;
  groups: BlunderListGroup[];
}

interface BlunderListGroupProps {
  group: BlunderListGroup;
  category: string;
  selected: OpenBlunder | null;
  query: string;
  depth: number;
}

/** One bucket. Renders its rows, or its child buckets if it has any. */
export function BlunderListGroup({
  group,
  category,
  selected,
  query,
  depth,
}: BlunderListGroupProps) {
  return (
    <Stack render={<section />} ml={3}>
      <Text render={depth === 0 ? <h3 /> : <h4 />} size={1} weight="bold">
        {group.label}{" "}
        <data value={group.total}>
          ({group.blunders.length} of {group.total})
        </data>
      </Text>

      {group.groups.length > 0 ? (
        group.groups.map((child) => (
          <BlunderListGroup
            key={child.id}
            group={child}
            category={category}
            selected={selected}
            query={query}
            depth={depth + 1}
          />
        ))
      ) : (
        <BlunderListLinks
          blunders={group.blunders}
          category={category}
          selected={selected}
          query={query}
        />
      )}
    </Stack>
  );
}

const sum = (counts: BucketCount[]) => counts.reduce((running, { count }) => running + count, 0);

/** Severity bands, the level every kind ends on. */
function bandsOf(blunders: Blunder[], counts: BucketCount[]): BlunderListGroup[] {
  const bySeverity = Object.groupBy(blunders, ({ error_magnitude }) => severityOf(error_magnitude));

  return SEVERITY_BANDS.flatMap(({ id, label }) => {
    const banded = bySeverity[id];
    const total = sum(counts.filter(({ severity }) => severity === id));
    return banded ? [{ id, label, blunders: banded, total, groups: [] }] : [];
  });
}

/**
 * Cube blunders get an extra level above severity: a cube error is still "how
 * much did this cost", but which side of the cube you were on is the thing that
 * makes two of them comparable.
 */
export function groupsOf(
  kind: BlunderKind,
  blunders: Blunder[],
  counts: BucketCount[],
): BlunderListGroup[] {
  const mine = counts.filter((bucket) => bucket.kind === kind);
  if (kind !== "cube") return bandsOf(blunders, mine);

  const byDirection = Object.groupBy(blunders, ({ cube_action }) => cubeDirection(cube_action));

  return CUBE_DIRECTIONS.flatMap(({ id, label }) => {
    const facing = byDirection[id];
    const facingCounts = mine.filter(({ direction }) => direction === id);

    return facing
      ? [
          {
            id,
            label,
            blunders: facing,
            total: sum(facingCounts),
            groups: bandsOf(facing, facingCounts),
          },
        ]
      : [];
  });
}

/** A group's rows top to bottom, or its child groups' rows if it has any. */
function rowsOf(group: BlunderListGroup): Blunder[] {
  return group.groups.length > 0 ? group.groups.flatMap(rowsOf) : group.blunders;
}

/**
 * A page's rows in the order the list draws them — kind, then side of the cube,
 * then severity — which is not the order the server sent them in. The two rows
 * of a `both` blunder are both here, as two stops.
 */
export function rowsInListOrder(
  data: { blunders: Blunder[]; counts: BucketCount[] } | undefined,
): Blunder[] {
  if (!data) return [];

  const byKind = Object.groupBy(data.blunders, (blunder) => blunder.kind);

  return KINDS.flatMap((kind) => {
    const blunders = byKind[kind];
    return blunders ? groupsOf(kind, blunders, data.counts).flatMap(rowsOf) : [];
  });
}
