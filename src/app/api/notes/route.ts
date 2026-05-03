import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiUser, jsonError, jsonRuntimeError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { notes } from "@/lib/schema";
import { getSection } from "@/lib/course";
import { ensureNotesSchema } from "@/lib/notes-schema";
import { isLocalMode } from "@/lib/mode";

const createNoteSchema = z.object({
  sectionId: z.string().min(1),
  body: z.string().default(""),
  quote: z.string().trim().max(12000).optional(),
  type: z.enum(["note", "highlight", "question", "voice"]).default("note"),
  tags: z.array(z.string()).default([]),
});

export async function GET(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  try {
    if (isLocalMode()) {
      const { listLocalNotes } = await import("@/lib/local-store");
      return NextResponse.json({ notes: listLocalNotes(user.id, sectionId) });
    }
    const db = getDb();
    await ensureNotesSchema();
    const rows = await db
      .select()
      .from(notes)
      .where(sectionId ? and(eq(notes.userId, user.id), eq(notes.sectionId, sectionId)) : eq(notes.userId, user.id))
      .orderBy(desc(notes.updatedAt));
    return NextResponse.json({ notes: rows });
  } catch (error) {
    return jsonRuntimeError(error, "Notes could not be loaded");
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const parsed = createNoteSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid note");
  if (!parsed.data.body.trim() && !parsed.data.quote?.trim()) return jsonError("Write a note or attach highlighted text before saving.");
  if (!getSection(parsed.data.sectionId)) return jsonError("Unknown section", 404);
  try {
    if (isLocalMode()) {
      const { createLocalNote } = await import("@/lib/local-store");
      const created = createLocalNote({ ...parsed.data, userId: user.id, quote: parsed.data.quote ?? null });
      return NextResponse.json({ note: created }, { status: 201 });
    }
    await ensureNotesSchema();
    const [created] = await getDb()
      .insert(notes)
      .values({ ...parsed.data, userId: user.id })
      .returning();
    return NextResponse.json({ note: created }, { status: 201 });
  } catch (error) {
    return jsonRuntimeError(error, "Note could not be saved");
  }
}
