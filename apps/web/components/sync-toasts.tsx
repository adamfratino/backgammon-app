"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress, useToastManager } from "@uiid/design-system";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { categoryLabel } from "@/lib/constants";
import { useTRPC } from "@/trpc/client";

const isRunning = (state: string | undefined): boolean =>
  state === "checking" || state === "scraping";

/**
 * Reports on the server's Galaxy syncs. The server decides when to sync; this
 * asks for one when the app opens, then listens. A run that finds nothing says
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

  // Fast while a run is going, so the bar moves; slow otherwise, to catch the interval's runs.
  const { data: status } = useQuery({
    ...trpc.sync.status.queryOptions(),
    refetchInterval: (query) => (isRunning(query.state.data?.state) ? 1000 : 30_000),
  });

  const [openedAt] = useState(() => new Date().toISOString());
  /**
   * The loading toast and how far along it shows. `update` hands back a new
   * manager, which re-runs the effect, so this is what stops it updating again.
   */
  const loading = useRef<{ runId: number; id: string; done: number } | null>(null);
  const announced = useRef<number | null>(null);

  useEffect(() => {
    if (!status?.runId || announced.current === status.runId) return;
    const { runId, state, category, done, total, newBlunders } = status;
    const ours = loading.current?.runId === runId ? loading.current.id : null;

    if (state === "scraping") {
      if (ours && loading.current?.done === done) return;
      const name = categoryLabel(category ?? "").toLowerCase();
      const progress = {
        title: "Syncing blunders",
        description: `Scraping ${name} (${done + 1} of ${total})`,
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
    // A run that finished before the page opened was already reported, or had nothing to say.
    if (!ours && (status.finishedAt ?? "") < openedAt) return;
    announced.current = runId;
    loading.current = null;

    if (state === "error") {
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

    if (newBlunders === 0) {
      if (ours) toastManager.close(ours);
      return;
    }

    const synced = {
      title: `${newBlunders} new ${newBlunders === 1 ? "blunder" : "blunders"}`,
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
  }, [status, openedAt, toastManager, queryClient, router]);

  return null;
}
