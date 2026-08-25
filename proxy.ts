import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The authoritative auth session lives in sessionStorage (client-side only),
// so the server cannot see it. This proxy performs only OPTIMISTIC checks
// based on the remember-me cookies:
//   - Redirect authenticated users (with remember-me cookies) away from /login.
//
// Route protection for authenticated pages is handled client-side by the
// <AuthGuard /> component (mirrors the old App.js session check).

const hasRememberMe = (req: NextRequest): boolean => {
  const userData = req.cookies.get("userData")?.value;
  const token = req.cookies.get("token")?.value;
  return Boolean(userData || token);
};

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Redirect authenticated users away from /login
  if (path === "/login" && hasRememberMe(req)) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

// Run on all routes except static assets and API routes
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
