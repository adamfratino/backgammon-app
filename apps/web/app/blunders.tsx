"use client";

import { useEffect, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/trpc/client";
import type { AppRouter } from "@/server/router";

/**
 * Derived from the router rather than declared. Change the procedure's output
 * and this type follows automatically — there is nothing to keep in sync.
 */
type Blunder = inferRouterOutputs<AppRouter>["blunders"]["list"][number];

export function Blunders() {
  const [blunders, setBlunders] = useState<Blunder[] | null>(null);

  useEffect(() => {
    trpc.blunders.list.query({ limit: 10 }).then(setBlunders);
  }, []);

  if (!blunders) return <p>Loading...</p>;

  return (
    <ul>
      {blunders.map((blunder) => (
        <li key={blunder.blunder_id}>
          {blunder.error_magnitude} {blunder.played_notation}
        </li>
      ))}
    </ul>
  );
}
