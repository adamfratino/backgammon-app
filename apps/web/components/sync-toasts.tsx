"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress, useToastManager } from "@uiid/design-system";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTRPC } from "@/trpc/client";

const isRunning = (state: string | undefined): boolean =>
  state === "checking" || state === "fetching";

/** The last run this browser reported on. Kept across visits, so runs it missed still count. */
const SEEN_KEY = "galaxy-sync:seen-run";

function readSeen(): number | null {
  if (typeof window === "undefined") return null;
  const seen = Number(window.localStorage.getItem(SEEN_KEY));
  return Number.isInteger(seen) && seen > 0 ? seen : null;
}

/**
 * Reports on the server's Galaxy syncs. The server decides when to sync; this
 * asks for one when the app opens, then listens. Opening the app also reports
 * whatever runs found while it was closed. A run that finds nothing says
 * nothing, which is almost every run.
 */
export function SyncToasts() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const toastManager = useToastManager();

  // A run the app starts is already checking when this returns, so look at once.
  const { mutate: start } = useMutation(
    trpc.sync.start.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.sync.status.queryFilter()),
    }),
  );
  useEffect(() => start(), [start]);

  const [seen, setSeen] = useState(readSeen);
  const remember = useCallback((runId: number): void => {
    window.localStorage.setItem(SEEN_KEY, String(runId));
    setSeen(runId);
  }, []);

  // Fast while a run is going, so the bar moves; slow otherwise, to catch the interval's runs.
  const { data: status } = useQuery({
    ...trpc.sync.status.queryOptions({ since: seen }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (isRunning(query.state.data?.state) ? 1000 : 30_000),
  });

  /**
   * The loading toast and how far along it shows. `update` hands back a new
   * manager, which re-runs the effect, so this is what stops it updating again.
   */
  const loading = useRef<{ runId: number; id: string; done: number } | null>(null);
  /** An expired login fails every run the same way; say so once, not every ten minutes. */
  const lastError = useRef<string | null>(null);

  useEffect(() => {
    if (!status?.runId) return;
    const { runId, state, done, total, newSince } = status;

    // A first visit starts from the latest run rather than reporting the whole history.
    if (seen === null) {
      remember(isRunning(state) ? runId - 1 : runId);
      return;
    }
    if (runId <= seen) return;
    const ours = loading.current?.runId === runId ? loading.current.id : null;

    if (state === "fetching") {
      if (ours && loading.current?.done === done) return;
      const progress = {
        title: "Syncing matches",
        description: `Match ${done + 1} of ${total}`,
        data: {
          children: <Progress value={done} max={total} hideValue aria-label="Sync progress" />,
        },
      };
      const id = ours ?? toastManager.add({ ...progress, type: "loading", timeout: 0 });
      if (ours) toastManager.update(ours, progress);
      loading.current = { runId, id, done };
      return;
    }

    if (state !== "done" && state !== "error") return;
    remember(runId);
    loading.current = null;

    if (state === "error") {
      if (!ours && status.error === lastError.current) return;
      lastError.current = status.error;
      const failed = {
        title: "Sync failed",
        description: status.error ?? undefined,
        type: "error",
        timeout: 0,
        data: { color: "red" as const },
      };
      if (ours) toastManager.update(ours, failed);
      else toastManager.add(failed);
      return;
    }
    lastError.current = null;

    if (newSince === 0) {
      if (ours) toastManager.close(ours);
      return;
    }

    const synced = {
      title: `${newSince} new ${newSince === 1 ? "blunder" : "blunders"}`,
      description: undefined,
      type: "success",
      timeout: 8000,
      actionProps: { children: "View", onClick: () => router.push("/matches") },
      data: { color: "green" as const },
    };
    if (ours) toastManager.update(ours, synced);
    else toastManager.add(synced);

    void queryClient.invalidateQueries();
    router.refresh();
  }, [status, seen, remember, toastManager, queryClient, router]);

  return null;
}
