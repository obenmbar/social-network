import { NextResponse } from "next/server";

const SESSION_COOKIE = "session_token";

export function proxy(request) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (!sessionToken && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

