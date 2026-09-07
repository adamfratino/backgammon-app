"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { KINDS, type BlunderKind } from "@/lib/blunders";
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
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>{KIND_LABELS[kind]}</h2>
              <data value={blunders.length}>({blunders.length})</data>
            </div>
            <ol>
              {blunders.map(({ blunder_id, error_magnitude }) => (
                <li key={blunder_id}>
                  <Link
                    href={`/${category}/${blunder_id}`}
                    aria-current={String(blunder_id) === selected ? "page" : undefined}
                  >
                    {error_magnitude.toFixed(3)}
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
