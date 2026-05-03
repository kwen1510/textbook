import { hasAuthConfig } from "./auth";
import { hasDatabaseConfig } from "./db";
import { isLocalMode } from "./mode";

export function getMissingSetup() {
  if (isLocalMode()) return [];
  const missing: string[] = [];
  if (!hasDatabaseConfig()) missing.push("DATABASE_URL");
  if (!hasAuthConfig()) missing.push("NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET");
  if (!process.env.ALLOWED_USER_EMAIL) missing.push("ALLOWED_USER_EMAIL");
  return Array.from(new Set(missing));
}
