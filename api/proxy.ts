import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-of-application routing guard.
 *
 * In Next.js 16 this file replaces `middleware.ts`; the named export must be
 * `proxy` and the runtime is always Node.js.
 *
 * This is an **optimistic** check only. It looks for the presence of a session
 * cookie so that signed-out visitors are redirected to the login page without a
 * database round trip. It deliberately does not read the session, verify the
 * role, or trust the cookie's contents — real authorisation happens in the
 * layouts and route handlers, which validate the session against the database.
 */

const SESSION_COOKIE = "ddmp.session_token";
const SECURE_SESSION_COOKIE = "__Secure-ddmp.session_token";

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has(SESSION_COOKIE) || request.cookies.has(SECURE_SESSION_COOKIE)
  );
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  const isLoginRoute = pathname === "/admin/login";
  const isAuthFlowRoute =
    pathname.startsWith("/admin/forgot-password") ||
    pathname.startsWith("/admin/reset-password") ||
    pathname.startsWith("/admin/verify-email");

  // Signed-in users have no reason to sit on the login page.
  if (isLoginRoute && hasSessionCookie(request)) {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  if (isLoginRoute || isAuthFlowRoute) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && !hasSessionCookie(request)) {
    const loginUrl = new URL("/admin/login", request.url);
    // Preserve where the user was heading so login can return them there.
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Only admin pages need the optimistic redirect. API routes authenticate
   * themselves and must return JSON 401s rather than an HTML redirect.
   */
  matcher: ["/admin/:path*"],
};
