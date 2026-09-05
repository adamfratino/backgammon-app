import { initTRPC } from "@trpc/server";
import { db } from "@/server/db";

/**
 * The context is built fresh for every request and handed to every procedure.
 * Anything request-scoped goes here: the database handle, the logged-in user,
 * the request headers.
 */
export function createContext() {
  return { db };
}

type Context = ReturnType<typeof createContext>;

/**
 * `initTRPC` returns the builders used to define the API. It is created exactly
 * once per app. Convention is to export the pieces rather than the `t` object.
 */
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
