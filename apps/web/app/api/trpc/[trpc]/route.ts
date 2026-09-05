import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/router";
import { createContext } from "@/server/trpc";

/**
 * Every tRPC call from the browser lands here as a plain HTTP request. The
 * adapter reads the procedure path off the URL, runs it, and serialises the
 * result. One HTTP route backs the entire API.
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
