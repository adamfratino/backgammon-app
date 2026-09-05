import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server/router";

/**
 * `AppRouter` is a type-only import, so none of the server code ships to the
 * browser — but `trpc.blunders.list.query` is fully typed from it, and breaks
 * at compile time if the procedure's input or output changes.
 */
export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});
