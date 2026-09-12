import type { Blunder, BucketCount } from "@/server/router";
import {
  CUBE_DIRECTIONS,
  SEVERITY_BANDS,
  severityOf,
  cubeDirection,
  type BlunderKind,
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
  selected: string | null;
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
  const Heading = depth === 0 ? "h3" : "h4";

  return (
    <section>
      <Heading>
        {group.label}{" "}
        <data value={group.total}>
          ({group.blunders.length} of {group.total})
        </data>
      </Heading>

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
    </section>
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
