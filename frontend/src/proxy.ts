import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow Next.js internals and API auth routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)
  ) {
    return NextResponse.next();
  }

  // Check session cookie (next-auth v5 uses "authjs.session-token" or "__Secure-authjs.session-token")
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  const isLoggedIn = !!sessionToken;
  const isAuthPage = pathname.startsWith("/auth");

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
