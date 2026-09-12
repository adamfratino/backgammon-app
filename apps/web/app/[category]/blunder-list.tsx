"use client";

import { useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

import { filterParams, filtersFrom, KINDS, KIND_LABELS, pageFrom } from "@/lib/constants";
import { useTRPC } from "@/trpc/client";

import { BlunderListPagination } from "./subcomponents/blunder-list-pagination";
import { BlunderListGroup, groupsOf } from "./subcomponents/blunder-list-group";

interface BlunderListProps {
  category: string;
}

export function BlunderList({ category }: BlunderListProps) {
  const trpc = useTRPC();

  const selected = useSelectedLayoutSegment();
  const searchParams = useSearchParams();
  const page = pageFrom(searchParams.get("page"));
  const filters = filtersFrom(searchParams);

  // What every link out of this list has to carry to come back to this view.
  const params = filterParams(filters);
  if (page > 1) params.set("page", String(page));
  const query = params.size > 0 ? `?${params}` : "";

  const { isPending, isPlaceholderData, error, data } = useQuery({
    ...trpc.blunders.byCategory.queryOptions({ category, page, ...filters }),
    placeholderData: keepPreviousData,
  });

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.total === 0) {
    const filtered = Object.values(filters).some(({ length }) => length > 0);
    return <p>{filtered ? "No blunders match these filters." : "No blunders in this category."}</p>;
  }

  const byKind = Object.groupBy(data.blunders, (blunder) => blunder.kind);

  return (
    <div aria-busy={isPlaceholderData} style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>
      <BlunderListPagination page={page} total={data.total} category={category} filters={filters} />
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
                  depth={0}
                  query={query}
                />
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
