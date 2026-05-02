import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { getSafeRuntimeDiagnostics } from "./runtime";

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: NextResponse.json({ error: "Authentication required" }, { status: 401 }) };
  }
  return { user, response: null };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonRuntimeError(error: unknown, message = "Runtime request failed") {
  console.error(message, error);
  return NextResponse.json({ error: message, detail: getSafeRuntimeDiagnostics(error) }, { status: 503 });
}
