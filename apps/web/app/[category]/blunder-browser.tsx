"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { AppRouter } from "@/server/router";
import { useTRPC } from "@/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";

type Blunder = inferRouterOutputs<AppRouter>["blunders"]["byCategory"][number];

export function BlunderBrowser({ category }: { category: string }) {
  const trpc = useTRPC();
  const [activeId, setActiveId] = useState<number | null>(null);

  const { isPending, isFetching, error, data } = useQuery(
    trpc.blunders.byCategory.queryOptions({ category }),
  );

  if (isPending) return <p>Loading...</p>;
  if (error) return <p role="alert">Could not load blunders: {error.message}</p>;
  if (data.length === 0) return <p>No blunders in this category.</p>;

  const active = data.find((b) => b.blunder_id === activeId) ?? null;

  return (
    <>
      <ol aria-busy={isFetching}>
        {data.map((blunder) => (
          <li key={blunder.blunder_id}>
            <button
              type="button"
              aria-current={blunder.blunder_id === activeId}
              onClick={() => setActiveId(blunder.blunder_id)}
            >
              {blunder.kind} {blunder.error_magnitude.toFixed(3)}
            </button>
          </li>
        ))}
      </ol>

      {active ? <BlunderDetail blunder={active} /> : null}
    </>
  );
}

function BlunderDetail({ blunder }: { blunder: Blunder }) {
  return (
    <article aria-label={`Blunder ${blunder.blunder_id}`}>
      <h2>Blunder {blunder.blunder_id}</h2>
      <dl>
        <dt style={{ fontWeight: "bold" }}>Kind</dt>
        <dd style={{ marginLeft: 0, marginBottom: 8 }}>{blunder.kind}</dd>

        <dt style={{ fontWeight: "bold" }}>Error</dt>
        <dd style={{ marginLeft: 0, marginBottom: 8 }}>{blunder.error_magnitude.toFixed(4)}</dd>

        <dt style={{ fontWeight: "bold" }}>Severity</dt>
        <dd style={{ marginLeft: 0, marginBottom: 8 }}>{blunder.error_severity ?? "—"}</dd>

        <dt style={{ fontWeight: "bold" }}>Score</dt>
        <dd style={{ marginLeft: 0, marginBottom: 8 }}>
          {blunder.score_black}–{blunder.score_white} to {blunder.match_length ?? "—"}
        </dd>

        {blunder.kind === "cube" ? (
          <>
            <dt style={{ fontWeight: "bold" }}>Doubler&rsquo;s best action</dt>
            <dd style={{ marginLeft: 0, marginBottom: 8 }}>
              {blunder.doublers_best_action ?? "—"}
            </dd>

            <dt style={{ fontWeight: "bold" }}>Receiver&rsquo;s best action</dt>
            <dd style={{ marginLeft: 0, marginBottom: 8 }}>
              {blunder.receivers_best_action ?? "—"}
            </dd>
          </>
        ) : (
          <>
            <dt style={{ fontWeight: "bold" }}>Played</dt>
            <dd style={{ marginLeft: 0, marginBottom: 8 }}>{blunder.played_notation ?? "—"}</dd>

            <dt style={{ fontWeight: "bold" }}>Best</dt>
            <dd style={{ marginLeft: 0, marginBottom: 8 }}>{blunder.best_notation ?? "—"}</dd>
          </>
        )}
      </dl>
    </article>
  );
}
