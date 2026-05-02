import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";

export type AppUser = {
  id: string;
  email: string;
  name?: string | null;
};

let authClient: NeonAuth | null = null;
const authFailureReasonSymbol = Symbol.for("textbook.auth-failure-reason");

type GlobalWithAuthReason = typeof globalThis & {
  [authFailureReasonSymbol]?: "missing_session" | "email_not_allowed" | "auth_error";
};

function setAuthFailureReason(reason: GlobalWithAuthReason[typeof authFailureReasonSymbol]) {
  (globalThis as GlobalWithAuthReason)[authFailureReasonSymbol] = reason;
}

export function getAuthFailureReason() {
  return (globalThis as GlobalWithAuthReason)[authFailureReasonSymbol];
}

export function hasAuthConfig() {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}

export function getAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret) throw new Error("Neon Auth is not configured.");
  if (!authClient) {
    authClient = createNeonAuth({
      baseUrl,
      cookies: { secret, sessionDataTtl: 300 },
    });
  }
  return authClient;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (!hasAuthConfig()) return null;
  try {
    const sessionResult = await getAuth().getSession();
    const session = sessionResult.data;
    const user = session?.user;
    if (!user?.id || !user.email) {
      setAuthFailureReason("missing_session");
      return null;
    }
    const allowedEmail = process.env.ALLOWED_USER_EMAIL;
    if (allowedEmail && user.email.toLowerCase() !== allowedEmail.toLowerCase()) {
      setAuthFailureReason("email_not_allowed");
      return null;
    }
    return { id: user.id, email: user.email, name: user.name };
  } catch (error) {
    console.error("Neon Auth session lookup failed", error);
    setAuthFailureReason("auth_error");
    return null;
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    const reason = getAuthFailureReason();
    redirect(reason ? `/auth/sign-in?reason=${reason}` : "/auth/sign-in");
  }
  return user;
}
