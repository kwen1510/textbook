import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiUser, jsonError, jsonRuntimeError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { notes } from "@/lib/schema";
import { ensureNotesSchema } from "@/lib/notes-schema";

const updateNoteSchema = z.object({
  body: z.string().optional(),
  quote: z.string().trim().max(12000).nullable().optional(),
  type: z.enum(["note", "highlight", "question", "voice"]).optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await params;
  const parsed = updateNoteSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid note update");
  if (parsed.data.body !== undefined && !parsed.data.body.trim() && !parsed.data.quote?.trim()) {
    return jsonError("Write a note or keep highlighted text before saving.");
  }
  try {
    await ensureNotesSchema();
    const [updated] = await getDb()
      .update(notes)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
      .returning();
    if (!updated) return jsonError("Note not found", 404);
    return NextResponse.json({ note: updated });
  } catch (error) {
    return jsonRuntimeError(error, "Note could not be updated");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await params;
  try {
    await ensureNotesSchema();
    const [deleted] = await getDb()
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
      .returning();
    if (!deleted) return jsonError("Note not found", 404);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonRuntimeError(error, "Note could not be deleted");
  }
}
