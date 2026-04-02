/**
 * API Proxy — forwards /api/v1/* requests to api-control at runtime.
 * Injects Bearer token from NextAuth session into upstream requests.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";

function getApiUrl(): string {
  return (
    process.env["API_INTERNAL_URL"] ??
    process.env["NEXT_PUBLIC_API_URL"] ??
    "http://localhost:3001/api/v1"
  );
}

async function proxyRequest(req: NextRequest) {
  const apiBase = getApiUrl();
  const path = req.nextUrl.pathname.replace(/^\/api\/v1/, "");
  const search = req.nextUrl.search;
  const target = `${apiBase}${path}${search}`;

  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (key === "host" || key === "connection" || key === "transfer-encoding")
      continue;
    headers.set(key, value);
  }

  // Inject Bearer token from NextAuth session if not already present
  if (!headers.has("authorization")) {
    try {
      const session = await auth();
      const token = (session as any)?.accessToken;
      if (token) {
        headers.set("authorization", `Bearer ${token}`);
      }
    } catch {
      // No session — pass through without auth
    }
  }

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? await req.blob()
          : undefined,
      // @ts-expect-error - duplex needed for streaming request bodies
      duplex: "half",
    });

    const responseHeaders = new Headers();
    for (const [key, value] of res.headers.entries()) {
      if (key === "transfer-encoding" || key === "connection") continue;
      responseHeaders.set(key, value);
    }

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error(`[api-proxy] Failed: ${req.method} ${target}`, err);
    return NextResponse.json(
      { error: { code: "PROXY_ERROR", message: "API service unavailable" } },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
