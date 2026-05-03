import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireApiUser, jsonError, jsonRuntimeError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSection } from "@/lib/course";
import { recallAttempts, reviewSchedules } from "@/lib/schema";
import { ensureReviewScheduleSchema } from "@/lib/review-schema";
import { isLocalMode } from "@/lib/mode";

const attemptSchema = z.object({
  sectionId: z.string().min(1),
  prompt: z.string().min(1),
  answer: z.string().min(1),
  rating: z.enum(["again", "hard", "good", "easy"]),
  mode: z.enum(["mcq", "open"]).optional(),
});

const ratingSchedule: Record<z.infer<typeof attemptSchema>["rating"], { minutes: number; intervalDays: number; masteryDelta: number }> = {
  again: { minutes: 30, intervalDays: 0, masteryDelta: -2 },
  hard: { minutes: 60 * 24, intervalDays: 1, masteryDelta: -1 },
  good: { minutes: 60 * 24 * 3, intervalDays: 3, masteryDelta: 1 },
  easy: { minutes: 60 * 24 * 7, intervalDays: 7, masteryDelta: 2 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const parsed = attemptSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid recall attempt");
  if (!getSection(parsed.data.sectionId)) return jsonError("Unknown section", 404);
  try {
    if (isLocalMode()) {
      const { createLocalRecallAttempt, getLocalReviewSchedule, upsertLocalReviewSchedule } = await import("@/lib/local-store");
      const attempt = createLocalRecallAttempt({ userId: user.id, sectionId: parsed.data.sectionId, prompt: parsed.data.prompt, answer: parsed.data.answer, rating: parsed.data.rating });
      const existingSchedule = getLocalReviewSchedule(user.id, parsed.data.sectionId);
      const schedule = ratingSchedule[parsed.data.rating];
      const now = new Date();
      const dueAt = new Date(now.getTime() + schedule.minutes * 60 * 1000);
      const masteryScore = clamp((existingSchedule?.masteryScore ?? 0) + schedule.masteryDelta, 0, 6);
      const attempts = (existingSchedule?.attempts ?? 0) + 1;
      const mode = parsed.data.mode ?? existingSchedule?.mode ?? "open";
      const nextSchedule = upsertLocalReviewSchedule({ userId: user.id, sectionId: parsed.data.sectionId, dueAt, intervalDays: schedule.intervalDays, masteryScore, attempts, lastRating: parsed.data.rating, mode });
      return NextResponse.json({ attempt, schedule: nextSchedule }, { status: 201 });
    }
    const db = getDb();
    await ensureReviewScheduleSchema();
    const [attempt] = await db
      .insert(recallAttempts)
      .values({ userId: user.id, sectionId: parsed.data.sectionId, prompt: parsed.data.prompt, answer: parsed.data.answer, rating: parsed.data.rating })
      .returning();

    const [existingSchedule] = await db
      .select()
      .from(reviewSchedules)
      .where(and(eq(reviewSchedules.userId, user.id), eq(reviewSchedules.sectionId, parsed.data.sectionId)))
      .limit(1);
    const schedule = ratingSchedule[parsed.data.rating];
    const now = new Date();
    const dueAt = new Date(now.getTime() + schedule.minutes * 60 * 1000);
    const masteryScore = clamp((existingSchedule?.masteryScore ?? 0) + schedule.masteryDelta, 0, 6);
    const attempts = (existingSchedule?.attempts ?? 0) + 1;
    const mode = parsed.data.mode ?? existingSchedule?.mode ?? "open";

    const [nextSchedule] = existingSchedule
      ? await db
          .update(reviewSchedules)
          .set({ dueAt, intervalDays: schedule.intervalDays, masteryScore, attempts, lastRating: parsed.data.rating, mode, updatedAt: now })
          .where(and(eq(reviewSchedules.userId, user.id), eq(reviewSchedules.sectionId, parsed.data.sectionId)))
          .returning()
      : await db
          .insert(reviewSchedules)
          .values({ userId: user.id, sectionId: parsed.data.sectionId, dueAt, intervalDays: schedule.intervalDays, masteryScore, attempts, lastRating: parsed.data.rating, mode, updatedAt: now })
          .returning();

    return NextResponse.json({ attempt, schedule: nextSchedule }, { status: 201 });
  } catch (error) {
    return jsonRuntimeError(error, "Recall attempt could not be saved");
  }
}
