import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabaseUrlIssue(value = process.env.DATABASE_URL) {
  if (!value) return "DATABASE_URL is not configured.";
  try {
    const url = new URL(value);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      return "DATABASE_URL must start with postgresql:// or postgres://.";
    }
    if (!url.username || !url.password || !url.hostname || !url.pathname || url.pathname === "/") {
      return "DATABASE_URL must include user, password, host, and database name.";
    }
    return null;
  } catch {
    return "DATABASE_URL is not a valid URL.";
  }
}

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  const issue = getDatabaseUrlIssue(databaseUrl);
  if (issue) throw new Error(issue);
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  if (!db) db = drizzle(neon(databaseUrl), { schema });
  return db;
}

export function hasDatabaseConfig() {
  return !getDatabaseUrlIssue();
}
