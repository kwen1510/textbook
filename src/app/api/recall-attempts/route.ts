import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, jsonError, jsonRuntimeError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSection } from "@/lib/course";
import { recallAttempts } from "@/lib/schema";

const attemptSchema = z.object({
  sectionId: z.string().min(1),
  prompt: z.string().min(1),
  answer: z.string().min(1),
  rating: z.enum(["again", "hard", "good", "easy"]),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const parsed = attemptSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid recall attempt");
  if (!getSection(parsed.data.sectionId)) return jsonError("Unknown section", 404);
  try {
    const [attempt] = await getDb()
      .insert(recallAttempts)
      .values({ userId: user.id, ...parsed.data })
      .returning();
    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    return jsonRuntimeError(error, "Recall attempt could not be saved");
  }
}
