import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AppChrome } from "@/components/AppChrome";
import { CourseLocationTracker } from "@/components/CourseLocationTracker";
import { CourseSelectionAssistant } from "@/components/CourseSelectionAssistant";
import { NotePanel } from "@/components/NotePanel";
import { RuntimeIssueNotice } from "@/components/RuntimeIssueNotice";
import { getChapter, getChapters } from "@/lib/course";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getErrorMessage } from "@/lib/runtime";
import { notes, progress } from "@/lib/schema";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return getChapters().map((chapter) => ({ chapterSlug: chapter.slug }));
}

export default async function CourseChapterPage({ params }: { params: Promise<{ chapterSlug: string }> }) {
  const { chapterSlug } = await params;
  const chapter = getChapter(chapterSlug);
  if (!chapter) notFound();
  const user = await requireUser();
  let chapterNotes: (typeof notes.$inferSelect)[];
  let progressRows: (typeof progress.$inferSelect)[];
  try {
    const db = getDb();
    chapterNotes = await db.select().from(notes).where(and(eq(notes.userId, user.id)));
    progressRows = await db.select().from(progress).where(eq(progress.userId, user.id));
  } catch (error) {
    console.error("Course page database query failed", error);
    return (
      <RuntimeIssueNotice
        title="Database connection failed"
        message="The course app is deployed, but Vercel DATABASE_URL is not a valid Neon Postgres connection string or the database is not reachable."
        detail={getErrorMessage(error)}
      />
    );
  }
  const progressBySection = new Map(progressRows.map((row) => [row.sectionId, row.state]));
  const notesBySection = new Map<string, typeof chapterNotes>();
  for (const note of chapterNotes) {
    if (!notesBySection.has(note.sectionId)) notesBySection.set(note.sectionId, []);
    notesBySection.get(note.sectionId)?.push(note);
  }
  const chapters = getChapters();
  const currentIndex = chapters.findIndex((item) => item.slug === chapter.slug);
  const previous = chapters[currentIndex - 1];
  const next = chapters[currentIndex + 1];
  const chapterCompleted = chapter.sections.filter((section) => progressBySection.get(section.id) === "completed").length;
  const chapterNeedsReview = chapter.sections.filter((section) => progressBySection.get(section.id) === "needs_review").length;

  return (
    <AppChrome userEmail={user.email}>
      <CourseLocationTracker chapterSlug={chapter.slug} />
      <main className="mx-auto grid w-full max-w-7xl gap-8 overflow-x-clip px-4 pb-52 pt-8 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] md:pb-16">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-auto rounded-[1.5rem] border border-stone-200 bg-white/75 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">Chapters</p>
            <nav className="grid gap-1 text-sm">
              {chapters.map((item) => <Link key={item.slug} className={`rounded-xl px-3 py-2 ${item.slug === chapter.slug ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"}`} href={`/course/${item.slug}`}>{item.title}</Link>)}
            </nav>
          </div>
        </aside>
        <div className="min-w-0">
          <div className="mb-6 rounded-[2rem] border border-stone-200 bg-white/80 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">{chapter.sourcePath}</p>
            <h1 className="mt-3 max-w-full break-words font-display text-4xl font-semibold leading-none tracking-tight text-stone-950 sm:text-5xl md:text-6xl">{chapter.title}</h1>
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-stone-600">
              <span className="rounded-full bg-stone-100 px-3 py-1">{chapterCompleted}/{chapter.sections.length} completed</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">{chapterNeedsReview} need review</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              {previous ? <Link className="rounded-full border border-stone-300 px-4 py-2" href={`/course/${previous.slug}`}>Previous</Link> : null}
              {next ? <Link className="rounded-full border border-stone-300 px-4 py-2" href={`/course/${next.slug}`}>Next</Link> : null}
            </div>
          </div>
          <nav aria-label="Sections in this chapter" className="mb-6 rounded-[1.5rem] border border-stone-200 bg-white/75 p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">On this chapter</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {chapter.sections.map((section) => (
                <Link key={section.id} href={`#${section.slug}`} className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 hover:border-amber-500 hover:text-amber-800">
                  {section.title}
                </Link>
              ))}
            </div>
          </nav>
          <div className="grid min-w-0 gap-8">
            {chapter.sections.map((section) => (
              <section key={section.id} id={section.slug} className="grid min-w-0 scroll-mt-24 gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
                <article data-course-section-id={section.id} data-course-section-title={section.title} className="course-prose min-w-0 overflow-hidden rounded-[2rem] border border-stone-200 bg-white/90 p-6 shadow-sm sm:p-8" dangerouslySetInnerHTML={{ __html: section.html }} />
                <NotePanel sectionId={section.id} sectionTitle={section.title} initialNotes={(notesBySection.get(section.id) ?? []).map((note) => ({ ...note, updatedAt: note.updatedAt.toISOString() }))} initialProgress={progressBySection.get(section.id)} />
              </section>
            ))}
          </div>
          <CourseSelectionAssistant />
          <div className="mt-8 flex flex-wrap justify-between gap-3 rounded-[1.5rem] border border-stone-200 bg-white/80 p-4">
            {previous ? <Link className="rounded-full border border-stone-300 px-4 py-2 font-semibold text-stone-700" href={`/course/${previous.slug}`}>Previous chapter</Link> : <span />}
            {next ? <Link className="rounded-full bg-stone-950 px-4 py-2 font-semibold text-white" href={`/course/${next.slug}`}>Next chapter</Link> : null}
          </div>
        </div>
      </main>
    </AppChrome>
  );
}
