import { NextResponse, type NextRequest } from "next/server";

/**
 * Layouts are not given `searchParams`, but they are given the request headers.
 * Forwarding the query string here is what lets `[category]/layout.tsx` prefetch
 * the page that was actually asked for.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-search", request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|api).*)",
};
