import { NextResponse, type NextRequest } from "next/server";

const CANONICAL_HOST = process.env.CANONICAL_HOST;

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0];
  if (!CANONICAL_HOST || !host || host === CANONICAL_HOST || host === "localhost" || host === "127.0.0.1") {
    return NextResponse.next();
  }

  if (host.endsWith(".vercel.app")) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
