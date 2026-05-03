import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDatabaseUrlIssue, getDb, hasDatabaseConfig } from "@/lib/db";
import { progress } from "@/lib/schema";
import { getSafeRuntimeDiagnostics } from "@/lib/runtime";
import { isLocalMode } from "@/lib/mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requiredTables = ["notes", "progress", "recall_attempts", "recall_prompts", "review_schedules", "transcription_jobs"];

function getAuthBaseUrlInfo() {
  const value = process.env.NEON_AUTH_BASE_URL;
  if (!value) return { configured: false };
  try {
    const url = new URL(value);
    return { configured: true, host: url.host, pathname: url.pathname };
  } catch {
    return { configured: true, valid: false };
  }
}

export async function GET() {
  if (isLocalMode()) {
    try {
      const { getLocalDb, getLocalStoreInfo } = await import("@/lib/local-store");
      getLocalDb();
      return NextResponse.json({
        ok: true,
        mode: "local",
        localStore: getLocalStoreInfo(),
        env: {
          groqApiKeyConfigured: Boolean(process.env.GROQ_API_KEY),
          nodeEnv: process.env.NODE_ENV,
        },
        database: { configured: true, type: "local-file" },
        auth: { configured: true, type: "local" },
      });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        mode: "local",
        database: { configured: false, type: "local-file", error: getSafeRuntimeDiagnostics(error) },
      }, { status: 503 });
    }
  }

  const diagnostics: Record<string, unknown> = {
    ok: true,
    env: {
      databaseUrlConfigured: hasDatabaseConfig(),
      databaseUrlIssue: getDatabaseUrlIssue(),
      neonAuthBaseUrl: getAuthBaseUrlInfo(),
      neonAuthCookieSecretLength: process.env.NEON_AUTH_COOKIE_SECRET?.length ?? 0,
      allowedUserEmailConfigured: Boolean(process.env.ALLOWED_USER_EMAIL),
      groqApiKeyConfigured: Boolean(process.env.GROQ_API_KEY),
      nodeEnv: process.env.NODE_ENV,
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    },
  };

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ ...diagnostics, ok: false, database: { configured: false } }, { status: 503 });
  }

  try {
    const db = getDb();
    const tables = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' and table_name in ('notes', 'progress', 'recall_attempts', 'recall_prompts', 'review_schedules', 'transcription_jobs') order by table_name`,
    );
    const tableNames = new Set(tables.rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter((table) => !tableNames.has(table));
    await db.select().from(progress).limit(1);

    return NextResponse.json({
      ...diagnostics,
      ok: missingTables.length === 0,
      database: {
        configured: true,
        requiredTablesPresent: missingTables.length === 0,
        missingTables,
      },
    }, { status: missingTables.length ? 503 : 200 });
  } catch (error) {
    return NextResponse.json({
      ...diagnostics,
      ok: false,
      database: {
        configured: true,
        error: getSafeRuntimeDiagnostics(error),
      },
    }, { status: 503 });
  }
}
