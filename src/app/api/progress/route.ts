import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, jsonError, jsonRuntimeError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSection } from "@/lib/course";
import { progress } from "@/lib/schema";
import { isLocalMode } from "@/lib/mode";

const progressSchema = z.object({
  sectionId: z.string().min(1).optional(),
  sectionIds: z.array(z.string().min(1)).optional(),
  state: z.enum(["unread", "reading", "completed", "needs_review"]),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const parsed = progressSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid progress update");
  const targetSectionIds = Array.from(new Set(parsed.data.sectionIds ?? (parsed.data.sectionId ? [parsed.data.sectionId] : [])));
  if (!targetSectionIds.length) return jsonError("Provide a sectionId or sectionIds.");
  if (targetSectionIds.some((sectionId) => !getSection(sectionId))) return jsonError("Unknown section", 404);
  try {
    if (isLocalMode()) {
      const { upsertLocalProgress } = await import("@/lib/local-store");
      const rows = upsertLocalProgress(user.id, targetSectionIds, parsed.data.state);
      return NextResponse.json({ progress: rows.length === 1 ? rows[0] : rows, progressRows: rows });
    }
    const rows = await getDb()
      .insert(progress)
      .values(targetSectionIds.map((sectionId) => ({ userId: user.id, sectionId, state: parsed.data.state })))
      .onConflictDoUpdate({
        target: [progress.userId, progress.sectionId],
        set: { state: parsed.data.state, updatedAt: new Date() },
      })
      .returning();
    return NextResponse.json({ progress: rows.length === 1 ? rows[0] : rows, progressRows: rows });
  } catch (error) {
    return jsonRuntimeError(error, "Progress could not be saved");
  }
}
