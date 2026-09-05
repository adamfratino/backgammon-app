import "server-only";
import { appRouter } from "@/server/router";
import { createCallerFactory, createContext } from "@/server/trpc";

/**
 * Calls procedures as plain functions, skipping the network entirely. Use this
 * from Server Components; the browser client in `trpc/client.ts` goes over HTTP.
 */
export const caller = createCallerFactory(appRouter)(createContext);
