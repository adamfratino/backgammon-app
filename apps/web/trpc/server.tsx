import "server-only";

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";

import { appRouter } from "@/server/router";
import { createContext } from "@/server/trpc";

import { makeQueryClient } from "./query-client";

/**
 * One QueryClient per request. `cache()` memoises for the lifetime of a single
 * server render, so the page and the dehydration step share an instance.
 */
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  router: appRouter,
  ctx: createContext,
  queryClient: getQueryClient,
});
