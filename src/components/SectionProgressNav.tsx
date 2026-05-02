"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  readingNotesProgressEvent,
  type ReadingNotesProgressDetail,
} from "@/lib/reading-notes-events";

type ProgressState = ReadingNotesProgressDetail["state"];

type SectionNavItem = {
  id: string;
  slug: string;
  title: string;
};

const statusMeta: Record<ProgressState, { label: string; dot: string; pill: string }> = {
  unread: {
    label: "Unread",
    dot: "bg-stone-300",
    pill: "bg-stone-100 text-stone-600",
  },
  reading: {
    label: "In progress",
    dot: "bg-sky-500",
    pill: "bg-sky-50 text-sky-800",
  },
  completed: {
    label: "Done",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-800",
  },
  needs_review: {
    label: "For review",
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-900",
  },
};

export function SectionProgressNav({
  sections,
  initialProgress,
}: {
  sections: SectionNavItem[];
  initialProgress: Record<string, ProgressState | undefined>;
}) {
  const [progressBySection, setProgressBySection] = useState(initialProgress);

  useEffect(() => {
    function handleProgress(event: Event) {
      const detail = (event as CustomEvent<ReadingNotesProgressDetail>).detail;
      if (!detail?.sectionId) return;
      setProgressBySection((current) => ({ ...current, [detail.sectionId]: detail.state }));
    }

    window.addEventListener(readingNotesProgressEvent, handleProgress);
    return () => window.removeEventListener(readingNotesProgressEvent, handleProgress);
  }, []);

  return (
    <nav aria-label="Sections in this chapter" className="mb-6 min-w-0 overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white/75 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">On this chapter</p>
        <div className="flex flex-wrap gap-2 text-[0.68rem] font-semibold text-stone-500">
          <Legend state="reading" />
          <Legend state="completed" />
          <Legend state="needs_review" />
        </div>
      </div>
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {sections.map((section) => {
          const state = progressBySection[section.id] ?? "unread";
          const meta = statusMeta[state];
          return (
            <Link
              key={section.id}
              href={`#${section.slug}`}
              aria-label={`${section.title}, ${meta.label}`}
              className="group flex max-w-[85vw] shrink-0 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 hover:border-amber-500 hover:text-amber-800"
            >
              <span className={`size-2.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
              <span className="min-w-0 max-w-[16rem] truncate">{section.title}</span>
              <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold sm:inline ${meta.pill}`}>
                {meta.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Legend({ state }: { state: Exclude<ProgressState, "unread"> }) {
  const meta = statusMeta[state];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
