import { eq } from "drizzle-orm";
import { AppChrome } from "@/components/AppChrome";
import { ReviewSession } from "@/components/ReviewSession";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getReviewCards } from "@/lib/review-cards";
import { progress, reviewSchedules } from "@/lib/schema";
import { RuntimeIssueNotice } from "@/components/RuntimeIssueNotice";
import { getErrorMessage } from "@/lib/runtime";
import { ensureReviewScheduleSchema } from "@/lib/review-schema";
import { isLocalMode } from "@/lib/mode";
import type { LocalProgress, LocalReviewSchedule } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await requireUser();
  let progressRows: (typeof progress.$inferSelect)[] | LocalProgress[];
  let scheduleRows: (typeof reviewSchedules.$inferSelect)[] | LocalReviewSchedule[];
  try {
    if (isLocalMode()) {
      const { listLocalProgress, listLocalReviewSchedules } = await import("@/lib/local-store");
      progressRows = listLocalProgress(user.id);
      scheduleRows = listLocalReviewSchedules(user.id);
    } else {
      const db = getDb();
      progressRows = await db.select().from(progress).where(eq(progress.userId, user.id));
      await ensureReviewScheduleSchema();
      scheduleRows = await db.select().from(reviewSchedules).where(eq(reviewSchedules.userId, user.id));
    }
  } catch (error) {
    console.error("Review page database query failed", error);
    return (
      <RuntimeIssueNotice
        title="Review data could not be loaded"
        message="The review page needs Neon Postgres to know what you have completed and what is due."
        detail={getErrorMessage(error)}
      />
    );
  }

  const studiedStates = new Map(progressRows.map((row) => [row.sectionId, row.state]));
  const schedules = new Map(scheduleRows.map((row) => [row.sectionId, row]));
  const now = new Date();
  const studiedCards = getReviewCards().filter((card) => {
    const state = studiedStates.get(card.sectionId);
    return state === "completed" || state === "needs_review";
  });
  const dueCards = studiedCards.filter((card) => {
    const schedule = schedules.get(card.sectionId);
    return studiedStates.get(card.sectionId) === "needs_review" || !schedule || schedule.dueAt <= now;
  });
  const masteredCount = scheduleRows.filter((row) => row.masteryScore >= 4 && row.lastRating === "easy").length;
  const nextDueAt = scheduleRows
    .filter((row) => row.dueAt > now)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())[0]?.dueAt;

  return (
    <AppChrome userEmail={user.email}>
      <main className="mx-auto max-w-4xl overflow-x-clip px-4 pb-28 pt-10 sm:px-6 md:pb-16">
        <p className="break-words text-xs font-semibold uppercase tracking-[0.28em] text-amber-700 sm:tracking-[0.35em]">Active recall</p>
        <h1 className="mt-3 break-words font-display text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">Review due cards</h1>
        <p className="mt-4 leading-7 text-stone-600">Only completed or marked-for-review sections appear here. Ratings schedule the next review so weak areas return sooner.</p>
        <div className="my-8 grid min-w-0 gap-3 sm:grid-cols-3">
          <Stat label="Studied" value={studiedCards.length} />
          <Stat label="Due now" value={dueCards.length} />
          <Stat label="Mastered" value={masteredCount} />
        </div>
        {dueCards.length ? <ReviewSession cards={dueCards} /> : (
          <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white/85 p-6 shadow-sm">
            <h2 className="break-words text-2xl font-semibold tracking-tight text-stone-950">{studiedCards.length ? "No reviews due right now." : "Complete sections to unlock review."}</h2>
            <p className="mt-3 leading-7 text-stone-600">
              {studiedCards.length
                ? `Your completed sections are scheduled. ${nextDueAt ? `Next review is due ${nextDueAt.toLocaleString()}.` : "Mark more sections complete or needs review to add cards."}`
                : "As you read, mark sections complete or needs review. Review mode will then generate MCQ and open scenario cards from those sections."}
            </p>
          </div>
        )}
      </main>
    </AppChrome>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-[1.25rem] border border-stone-200 bg-white/80 p-4 shadow-sm">
      <p className="break-words text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">{label}</p>
      <p className="mt-2 break-words text-3xl font-semibold tracking-tight text-stone-950">{value}</p>
    </div>
  );
}
