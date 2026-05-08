import { NextResponse } from "next/server";

const hopByHopHeaders = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const SESSION_COOKIE = "session_token";
const MAX_SESSION_TOKEN_LENGTH = 128;

async function handler(request, { params }) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
  const path = (await params).path.join("/");
  const targetUrl = new URL(`/${path}`, backendUrl);
  targetUrl.search = new URL(request.url).search;

  const headers = new Headers();
  copyHeader(request.headers, headers, "accept");
  copyHeader(request.headers, headers, "content-type");

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken && sessionToken.length > MAX_SESSION_TOKEN_LENGTH) {
    return clearSessionResponse("Request headers too large", 431);
  }
  if (sessionToken) {
    headers.set("cookie", `session_token=${sessionToken}`);
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const response = await fetch(targetUrl, {
    method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  response.headers.forEach((value, key) => {
    const headerName = key.toLowerCase();
    if (!hopByHopHeaders.has(headerName) && headerName !== "set-cookie") {
      responseHeaders.set(key, value);
    }
  });

  const nextResponse = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });

  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    setCookies.forEach((cookie) => nextResponse.headers.append("set-cookie", cookie));
  } else {
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      nextResponse.headers.append("set-cookie", setCookie);
    }
  }

  return nextResponse;
}

function copyHeader(from, to, name) {
  const value = from.get(name);
  if (value) {
    to.set(name, value);
  }
}

function clearSessionResponse(message, status) {
  const response = NextResponse.json({ error: message }, { status });
  appendClearSessionCookies(response.headers);
  return response;
}

function appendClearSessionCookies(headers) {
  const cookieBase = `${SESSION_COOKIE}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax`;
  headers.append("set-cookie", `${cookieBase}; Path=/`);
  headers.append("set-cookie", `${cookieBase}; Path=/api`);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
