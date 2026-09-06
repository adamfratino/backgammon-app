"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";

import type { AppRouter } from "../server/router";
import { makeQueryClient } from "./query-client";

/**
 * The typed proxy and its provider. `useTRPC()` returns an object shaped like
 * the router, where every procedure exposes `queryOptions`, `queryKey`,
 * `queryFilter`, `mutationOptions` — builders, not hooks.
 */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  return (browserQueryClient ??= makeQueryClient());
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  const [trpcClient] = useState(() => {
    return createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc" })],
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
