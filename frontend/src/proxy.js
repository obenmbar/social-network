import { NextResponse } from "next/server";

const SESSION_COOKIE = "session_token";
const MAX_SESSION_TOKEN_LENGTH = 128;

export function proxy(request) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (sessionToken && sessionToken.length > MAX_SESSION_TOKEN_LENGTH) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    appendClearSessionCookies(response.headers);
    return response;
  }

  if (!sessionToken && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

function appendClearSessionCookies(headers) {
  const cookieBase = `${SESSION_COOKIE}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`;
  headers.append("set-cookie", `${cookieBase}; Path=/`);
  headers.append("set-cookie", `${cookieBase}; Path=/api`);
}
