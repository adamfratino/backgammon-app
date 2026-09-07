"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";

interface BlunderListProps {
  category: string;
}

export function BlunderList({ category }: BlunderListProps) {
  const trpc = useTRPC();

  const selected = useSelectedLayoutSegment();

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.length === 0) return <p>No blunders in this category.</p>;

  return (
    <ol aria-busy={isFetching}>
      {data.map(({ blunder_id, kind, error_magnitude }) => (
        <li key={blunder_id}>
          <Link
            href={`/${category}/${blunder_id}`}
            aria-current={String(blunder_id) === selected ? "page" : undefined}
          >
            {kind} {error_magnitude.toFixed(3)}
          </Link>
        </li>
      ))}
    </ol>
  );
}
