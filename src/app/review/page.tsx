import { AppChrome } from "@/components/AppChrome";
import { ReviewCard } from "@/components/ReviewCard";
import { getChapters, getSectionLocation } from "@/lib/course";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await requireUser();
  const cards = getChapters().flatMap((chapter) => chapter.sections.slice(0, 2).map((section) => ({ chapter, section })));
  return (
    <AppChrome userEmail={user.email}>
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-10 sm:px-6 md:pb-16">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700">Active recall</p>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight text-stone-950">Review prompts</h1>
        <p className="mt-4 mb-8 leading-7 text-stone-600">Answer before checking the course. Ratings are stored so weak areas can be revisited.</p>
        <div className="grid gap-5">
          {cards.map(({ chapter, section }) => <ReviewCard key={section.id} sectionId={section.id} chapterTitle={chapter.title} sectionTitle={section.title} prompt={section.recallPrompt} href={getSectionLocation(section.id)?.href ?? `/course/${chapter.slug}`} />)}
        </div>
      </main>
    </AppChrome>
  );
}
