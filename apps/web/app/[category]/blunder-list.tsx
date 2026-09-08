"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { KINDS, SEVERITY_BANDS, severityOf, type BlunderKind } from "@/lib/blunders";
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

        const bySeverity = Object.groupBy(blunders, ({ error_magnitude }) => {
          return severityOf(error_magnitude);
        });

        return (
          <section key={kind}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{KIND_LABELS[kind]}</h2>
              <data value={blunders.length}>({blunders.length})</data>
            </div>
            {SEVERITY_BANDS.map(({ id, label }) => {
              const banded = bySeverity[id];
              if (!banded) return null;

              return (
                <section key={id}>
                  <h3>
                    {label} <data value={banded.length}>({banded.length})</data>
                  </h3>
                  <BlunderLinks blunders={banded} category={category} selected={selected} />
                </section>
              );
            })}
          </section>
        );
      })}
    </div>
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
