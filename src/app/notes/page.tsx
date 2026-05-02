import { desc, eq } from "drizzle-orm";
import { AppChrome } from "@/components/AppChrome";
import { NotesSearch } from "@/components/NotesSearch";
import { RuntimeIssueNotice } from "@/components/RuntimeIssueNotice";
import { getAllSections, getChapters, getSectionLocation } from "@/lib/course";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getErrorMessage } from "@/lib/runtime";
import { ensureNotesSchema } from "@/lib/notes-schema";
import { notes } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const user = await requireUser();
  let rows: (typeof notes.$inferSelect)[];
  try {
    await ensureNotesSchema();
    rows = await getDb().select().from(notes).where(eq(notes.userId, user.id)).orderBy(desc(notes.updatedAt));
  } catch (error) {
    console.error("Notes page database query failed", error);
    return (
      <RuntimeIssueNotice
        title="Database connection failed"
        message="The notes page needs Neon Postgres, but Vercel DATABASE_URL is not valid or the database is not reachable."
        detail={getErrorMessage(error)}
      />
    );
  }
  const sections = new Map(getAllSections().map((section) => [section.id, section]));
  const chapters = new Map(getChapters().map((chapter) => [chapter.slug, chapter]));
  const enriched = rows.map((note) => {
    const section = sections.get(note.sectionId);
    const chapter = section ? chapters.get(section.chapterSlug) : undefined;
    return {
      id: note.id,
      body: note.body,
      quote: note.quote,
      type: note.type,
      sectionId: note.sectionId,
      updatedAt: note.updatedAt.toISOString(),
      sectionTitle: section?.title ?? note.sectionId,
      chapterTitle: chapter?.title ?? "Unknown chapter",
      href: getSectionLocation(note.sectionId)?.href ?? "/",
    };
  });

  return (
    <AppChrome userEmail={user.email}>
      <main className="mx-auto max-w-4xl overflow-x-clip px-4 pb-28 pt-10 sm:px-6 md:pb-16">
        <p className="break-words text-xs font-semibold uppercase tracking-[0.28em] text-amber-700 sm:tracking-[0.35em]">Database view</p>
        <h1 className="mt-3 break-words font-display text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">Your notes</h1>
        <p className="mt-4 mb-8 leading-7 text-stone-600">Search across page notes and highlighted notes synced to Neon.</p>
        <NotesSearch notes={enriched} />
      </main>
    </AppChrome>
  );
}
