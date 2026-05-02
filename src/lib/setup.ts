import { hasAuthConfig } from "./auth";
import { hasDatabaseConfig } from "./db";

export function getMissingSetup() {
  const missing: string[] = [];
  if (!hasDatabaseConfig()) missing.push("DATABASE_URL");
  if (!hasAuthConfig()) missing.push("NEON_AUTH_BASE_URL", "NEON_AUTH_COOKIE_SECRET");
  if (!process.env.ALLOWED_USER_EMAIL) missing.push("ALLOWED_USER_EMAIL");
  if (!process.env.GROQ_API_KEY) missing.push("GROQ_API_KEY");
  return Array.from(new Set(missing));
}
