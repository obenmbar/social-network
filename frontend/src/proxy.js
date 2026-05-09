import { NextResponse } from "next/server";

const SESSION_COOKIE = "session_token";
const sessionTokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function proxy(request) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (sessionToken && !sessionTokenPattern.test(sessionToken)) {
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
