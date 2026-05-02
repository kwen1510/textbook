import { sql } from "drizzle-orm";
import { getDb } from "./db";

let ensuredNotesSchema = false;

export async function ensureNotesSchema() {
  if (ensuredNotesSchema) return;
  await getDb().execute(sql`alter table "notes" add column if not exists "quote" text`);
  ensuredNotesSchema = true;
}
