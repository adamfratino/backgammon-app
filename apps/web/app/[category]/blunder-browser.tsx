"use client";

import { useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/server/router";

type Blunder = inferRouterOutputs<AppRouter>["blunders"]["byCategory"][number];

export function BlunderBrowser({ category }: { category: string }) {
  const [blunders, setBlunders] = useState<Blunder[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    setBlunders(null);
    setActiveId(null);
    trpc.blunders.byCategory.query({ category }).then(setBlunders);
  }, [category]);

  if (!blunders) return <p>Loading...</p>;
  if (blunders.length === 0) return <p>No blunders in this category.</p>;

  const active = blunders.find((b) => b.blunder_id === activeId) ?? null;

  return (
    <>
      <ol>
        {blunders.map((blunder) => (
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
        <dt>Kind</dt>
        <dd>{blunder.kind}</dd>

        <dt>Error</dt>
        <dd>{blunder.error_magnitude.toFixed(4)}</dd>

        <dt>Severity</dt>
        <dd>{blunder.error_severity ?? "—"}</dd>

        <dt>Score</dt>
        <dd>
          {blunder.score_black}–{blunder.score_white} to {blunder.match_length ?? "—"}
        </dd>

        {blunder.kind === "cube" ? (
          <>
            <dt>Doubler&rsquo;s best action</dt>
            <dd>{blunder.doublers_best_action ?? "—"}</dd>

            <dt>Receiver&rsquo;s best action</dt>
            <dd>{blunder.receivers_best_action ?? "—"}</dd>
          </>
        ) : (
          <>
            <dt>Played</dt>
            <dd>{blunder.played_notation ?? "—"}</dd>

            <dt>Best</dt>
            <dd>{blunder.best_notation ?? "—"}</dd>
          </>
        )}
      </dl>
    </article>
  );
}
