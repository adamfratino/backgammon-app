"use client";

import { useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import { KINDS, KIND_LABELS, pageFrom } from "@/lib/constants";
import { useTRPC } from "@/trpc/client";

import { BlunderListPagination } from "./subcomponents/blunder-list-pagination";
import { BlunderListGroup, groupsOf } from "./subcomponents/blunder-list-group";

interface BlunderListProps {
  category: string;
}

export function BlunderList({ category }: BlunderListProps) {
  const trpc = useTRPC();

  const selected = useSelectedLayoutSegment();
  const page = pageFrom(useSearchParams().get("page"));

  const { isPending, isPlaceholderData, error, data } = useQuery({
    ...trpc.blunders.byCategory.queryOptions({ category, page }),
    placeholderData: keepPreviousData,
  });

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.total === 0) return <p>No blunders in this category.</p>;

  const byKind = Object.groupBy(data.blunders, (blunder) => blunder.kind);

  return (
    <div aria-busy={isPlaceholderData} style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
      <BlunderListPagination page={page} total={data.total} category={category} />
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
                <BlunderListGroup
                  key={group.id}
                  group={group}
                  category={category}
                  selected={selected}
                  page={page}
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
