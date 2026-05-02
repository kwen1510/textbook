import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, jsonError, jsonRuntimeError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSection } from "@/lib/course";
import { progress } from "@/lib/schema";

const progressSchema = z.object({
  sectionId: z.string().min(1),
  state: z.enum(["unread", "reading", "completed", "needs_review"]),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const parsed = progressSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid progress update");
  if (!getSection(parsed.data.sectionId)) return jsonError("Unknown section", 404);
  try {
    const [row] = await getDb()
      .insert(progress)
      .values({ userId: user.id, ...parsed.data })
      .onConflictDoUpdate({
        target: [progress.userId, progress.sectionId],
        set: { state: parsed.data.state, updatedAt: new Date() },
      })
      .returning();
    return NextResponse.json({ progress: row });
  } catch (error) {
    return jsonRuntimeError(error, "Progress could not be saved");
  }
}
