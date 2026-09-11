import type { Blunder } from "@/server/router";
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
  groups: BlunderListGroup[];
}

interface BlunderListGroupProps {
  group: BlunderListGroup;
  category: string;
  selected: string | null;
  page: number;
  depth: number;
}

/** One bucket. Renders its rows, or its child buckets if it has any. */
export function BlunderListGroup({
  group,
  category,
  selected,
  page,
  depth,
}: BlunderListGroupProps) {
  const Heading = depth === 0 ? "h3" : "h4";

  return (
    <section>
      <Heading>
        {group.label} <data value={group.blunders.length}>({group.blunders.length})</data>
      </Heading>

      {group.groups.length > 0 ? (
        group.groups.map((child) => (
          <BlunderListGroup
            key={child.id}
            group={child}
            category={category}
            selected={selected}
            page={page}
            depth={depth + 1}
          />
        ))
      ) : (
        <BlunderListLinks
          blunders={group.blunders}
          category={category}
          selected={selected}
          page={page}
        />
      )}
    </section>
  );
}

/** Severity bands, the level every kind ends on. */
function bandsOf(blunders: Blunder[]): BlunderListGroup[] {
  const bySeverity = Object.groupBy(blunders, ({ error_magnitude }) => severityOf(error_magnitude));

  return SEVERITY_BANDS.flatMap(({ id, label }) => {
    const banded = bySeverity[id];
    return banded ? [{ id, label, blunders: banded, groups: [] }] : [];
  });
}

/**
 * Cube blunders get an extra level above severity: a cube error is still "how
 * much did this cost", but which side of the cube you were on is the thing that
 * makes two of them comparable.
 */
export function groupsOf(kind: BlunderKind, blunders: Blunder[]): BlunderListGroup[] {
  if (kind !== "cube") return bandsOf(blunders);

  const byDirection = Object.groupBy(blunders, ({ cube_action }) => cubeDirection(cube_action));

  return CUBE_DIRECTIONS.flatMap(({ id, label }) => {
    const facing = byDirection[id];
    return facing ? [{ id, label, blunders: facing, groups: bandsOf(facing) }] : [];
  });
}
