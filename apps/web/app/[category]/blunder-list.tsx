"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  CUBE_DIRECTIONS,
  cubeDirection,
  KINDS,
  SEVERITY_BANDS,
  severityOf,
  type BlunderKind,
} from "@/lib/blunders";
import type { Blunder } from "@/server/router";
import { useTRPC } from "@/trpc/client";

interface BlunderListProps {
  category: string;
}

const KIND_LABELS: Record<BlunderKind, string> = {
  checker: "Checker plays",
  cube: "Cube decisions",
  both: "Both checker and cube",
};

export function BlunderList({ category }: BlunderListProps) {
  const trpc = useTRPC();

  const selected = useSelectedLayoutSegment();

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.length === 0) return <p>No blunders in this category.</p>;

  const byKind = Object.groupBy(data, (blunder) => blunder.kind);

  return (
    <div aria-busy={isFetching}>
      {KINDS.map((kind) => {
        const blunders = byKind[kind];
        if (!blunders) return null;

        return (
          <section key={kind}>
            <h2 style={{ margin: 0 }}>
              {KIND_LABELS[kind]} <data value={blunders.length}>({blunders.length})</data>
            </h2>

            {groupsOf(kind, blunders).map((group) => {
              return (
                <BlunderGroup
                  key={group.id}
                  group={group}
                  category={category}
                  selected={selected}
                  depth={0}
                />
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

interface BlunderGroup {
  id: string;
  label: string;
  blunders: Blunder[];
  groups: BlunderGroup[];
}

/** Severity bands, the level every kind ends on. */
function bandsOf(blunders: Blunder[]): BlunderGroup[] {
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
function groupsOf(kind: BlunderKind, blunders: Blunder[]): BlunderGroup[] {
  if (kind !== "cube") return bandsOf(blunders);

  const byDirection = Object.groupBy(blunders, ({ cube_action }) => cubeDirection(cube_action));

  return CUBE_DIRECTIONS.flatMap(({ id, label }) => {
    const facing = byDirection[id];
    return facing ? [{ id, label, blunders: facing, groups: bandsOf(facing) }] : [];
  });
}

interface BlunderGroupProps {
  group: BlunderGroup;
  category: string;
  selected: string | null;
  depth: number;
}

/** One bucket. Renders its rows, or its child buckets if it has any. */
function BlunderGroup({ group, category, selected, depth }: BlunderGroupProps) {
  const Heading = depth === 0 ? "h3" : "h4";

  return (
    <section>
      <Heading>
        {group.label} <data value={group.blunders.length}>({group.blunders.length})</data>
      </Heading>

      {group.groups.length > 0 ? (
        group.groups.map((child) => (
          <BlunderGroup
            key={child.id}
            group={child}
            category={category}
            selected={selected}
            depth={depth + 1}
          />
        ))
      ) : (
        <BlunderLinks blunders={group.blunders} category={category} selected={selected} />
      )}
    </section>
  );
}

interface BlunderLinkProps {
  blunders: Blunder[];
  category: string;
  selected: string | null;
}

function BlunderLinks({ blunders, category, selected }: BlunderLinkProps) {
  return (
    <ol>
      {blunders.map(({ blunder_id, error_magnitude, played_notation, cube_action, kind }) => (
        <li key={blunder_id}>
          <Link
            href={`/${category}/${blunder_id}`}
            aria-current={String(blunder_id) === selected ? "page" : undefined}
          >
            [{error_magnitude.toFixed(3)}] {played_notation ? `${played_notation}` : null}{" "}
            {kind !== "checker" ? cube_action : null}
          </Link>
        </li>
      ))}
    </ol>
  );
}
