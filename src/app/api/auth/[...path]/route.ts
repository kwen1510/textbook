import { NextResponse, type NextRequest } from "next/server";
import { getAuth, hasAuthConfig } from "@/lib/auth";

type AuthRouteContext = { params: Promise<{ path: string[] }> };

export const runtime = "nodejs";

function missingAuthResponse() {
  return NextResponse.json({ error: "Neon Auth is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET." }, { status: 503 });
}

function getSafeAuthDiagnostics(error: unknown) {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  let authBaseUrl: { host?: string; pathname?: string; valid: boolean } = { valid: false };
  if (baseUrl) {
    try {
      const url = new URL(baseUrl);
      authBaseUrl = { host: url.host, pathname: url.pathname, valid: true };
    } catch {
      authBaseUrl = { valid: false };
    }
  }
  return {
    message: error instanceof Error ? error.message : "Unknown auth error",
    name: error instanceof Error ? error.name : "UnknownError",
    authBaseUrl,
    cookieSecretLength: process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0,
    nodeEnv: process.env.NODE_ENV,
  };
}

async function handle(request: NextRequest, context: AuthRouteContext, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE") {
  if (!hasAuthConfig()) return missingAuthResponse();
  try {
    const handlers = getAuth().handler();
    const handler = handlers[method as keyof typeof handlers];
    if (!handler) return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
    return await (handler as (req: NextRequest, context: AuthRouteContext) => Promise<Response>)(request, context);
  } catch (error) {
    console.error("Neon Auth route failed", error);
    return NextResponse.json({
      error: "Neon Auth request failed. Check NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET in Vercel.",
      diagnostics: getSafeAuthDiagnostics(error),
    }, { status: 503 });
  }
}

export function GET(request: NextRequest, context: AuthRouteContext) {
  return handle(request, context, "GET");
}

export function POST(request: NextRequest, context: AuthRouteContext) {
  return handle(request, context, "POST");
}

export function PUT(request: NextRequest, context: AuthRouteContext) {
  return handle(request, context, "PUT");
}

export function PATCH(request: NextRequest, context: AuthRouteContext) {
  return handle(request, context, "PATCH");
}

export function DELETE(request: NextRequest, context: AuthRouteContext) {
  return handle(request, context, "DELETE");
}
