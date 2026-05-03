import Link from "next/link";
import { eq } from "drizzle-orm";
import { AppChrome } from "@/components/AppChrome";
import { RuntimeIssueNotice } from "@/components/RuntimeIssueNotice";
import { SetupNotice } from "@/components/SetupNotice";
import { courseData, getChapters, getFirstChapter, getAllSections, getSectionLocation } from "@/lib/course";
import { requireUser } from "@/lib/auth";
import { getMissingSetup } from "@/lib/setup";
import { getDb } from "@/lib/db";
import { getErrorMessage } from "@/lib/runtime";
import { progress } from "@/lib/schema";
import { isLocalMode } from "@/lib/mode";
import type { LocalProgress } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const missing = getMissingSetup();
  if (missing.length) return <SetupNotice missing={missing} />;
  const user = await requireUser();
  const chapters = getChapters();
  const sections = getAllSections();
  let progressRows: (typeof progress.$inferSelect)[] | LocalProgress[];
  try {
    if (isLocalMode()) {
      const { listLocalProgress } = await import("@/lib/local-store");
      progressRows = listLocalProgress(user.id);
    } else {
      progressRows = await getDb().select().from(progress).where(eq(progress.userId, user.id));
    }
  } catch (error) {
    console.error("Home page database query failed", error);
    return (
      <RuntimeIssueNotice
        title="Database connection failed"
        message="The app is deployed, but Vercel DATABASE_URL is not a valid Neon Postgres connection string or the database is not reachable."
        detail={getErrorMessage(error)}
      />
    );
  }
  const completed = progressRows.filter((row) => row.state === "completed").length;
  const needsReview = progressRows.filter((row) => row.state === "needs_review").length;
  const latestViewed = progressRows
    .filter((row) => getSectionLocation(row.sectionId))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const firstUnfinished = sections.find((section) => !progressRows.some((row) => row.sectionId === section.id && row.state === "completed"));
  const latestViewedIndex = latestViewed ? sections.findIndex((section) => section.id === latestViewed.sectionId) : -1;
  const nextAfterLatest = latestViewedIndex >= 0
    ? sections.slice(latestViewedIndex + 1).find((section) => !progressRows.some((row) => row.sectionId === section.id && row.state === "completed"))
    : undefined;
  const resumeLocation = latestViewed ? getSectionLocation(latestViewed.sectionId) : null;
  const nextLocation = latestViewed?.state === "completed"
    ? (nextAfterLatest ? getSectionLocation(nextAfterLatest.id) : null)
    : null;
  const fallbackLocation = firstUnfinished ? getSectionLocation(firstUnfinished.id) : null;
  const continueLocation = nextLocation ?? resumeLocation ?? fallbackLocation;
  const continueHref = continueLocation?.href ?? `/course/${getFirstChapter()?.slug}`;
  const continueLabel = completed || latestViewed ? "Continue reading" : "Start reading";
  const resumeState = nextLocation ? "Up next" : latestViewed?.state === "needs_review" ? "For review" : latestViewed?.state === "completed" ? "Completed" : latestViewed?.state === "reading" ? "In progress" : "Ready";

  return (
    <AppChrome userEmail={user.email}>
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-10 sm:px-6 md:pb-16">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="rounded-[2.5rem] bg-stone-950 p-8 text-white shadow-2xl shadow-stone-900/20 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">Pinned source · {courseData.source.commit.slice(0, 7)}</p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-none tracking-tight sm:text-7xl">Textbook turns reading into practice.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-300">Read the course in chapters, save notes per section, add optional AI voice notes, and review recall prompts from your phone or iPad.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={continueHref} className="rounded-full bg-amber-400 px-5 py-3 font-semibold text-stone-950">{continueLabel}</Link>
              <Link href="/review" className="rounded-full border border-white/20 px-5 py-3 font-semibold text-white">Practice recall</Link>
            </div>
            {continueLocation ? (
              <div className="mt-6 max-w-2xl rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">Resume point · {resumeState}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-stone-500">Page</p>
                    <p className="mt-1 break-words text-sm font-semibold text-stone-200">{continueLocation.chapter.title}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-stone-500">Section</p>
                    <p className="mt-1 break-words text-lg font-semibold text-white">{continueLocation.section.title}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <Stat label="Chapters" value={chapters.length} />
            <Stat label="Sections" value={sections.length} />
            <Stat label="Completed" value={`${completed}/${sections.length}`} detail={needsReview ? `${needsReview} need review` : "No review flags"} />
          </div>
        </section>
        <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => (
            <Link key={chapter.slug} href={`/course/${chapter.slug}`} className="group rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-900/10">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">{chapter.sections.length} sections</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950 group-hover:text-amber-800">{chapter.title}</h2>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-600">{chapter.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </AppChrome>
  );
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">{label}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight text-stone-950">{value}</p>
      {detail ? <p className="mt-2 text-sm text-stone-500">{detail}</p> : null}
    </div>
  );
}
