"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  readingNotesProgressEvent,
  type ReadingNotesProgressDetail,
} from "@/lib/reading-notes-events";

export type ProgressState = ReadingNotesProgressDetail["state"];
export type ChapterStatus = ProgressState;

export type ChapterNavItem = {
  slug: string;
  title: string;
  sectionIds: string[];
};

const statusMeta: Record<ChapterStatus, { label: string; dot: string; mutedDot: string }> = {
  unread: { label: "Unread", dot: "bg-stone-300", mutedDot: "bg-stone-300" },
  reading: { label: "In progress", dot: "bg-sky-500", mutedDot: "bg-sky-400" },
  completed: { label: "Done", dot: "bg-emerald-500", mutedDot: "bg-emerald-400" },
  needs_review: { label: "For review", dot: "bg-amber-500", mutedDot: "bg-amber-400" },
};

function getChapterStatus(sectionIds: string[], progressBySection: Record<string, ProgressState | undefined>): ChapterStatus {
  const states = sectionIds.map((id) => progressBySection[id] ?? "unread");
  if (states.some((state) => state === "needs_review")) return "needs_review";
  if (states.length && states.every((state) => state === "completed")) return "completed";
  if (states.some((state) => state === "reading" || state === "completed")) return "reading";
  return "unread";
}

export function ChapterMenuButton({ onClick, expanded = false }: { onClick: () => void; expanded?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white/80 px-3 py-2 text-xs font-semibold text-stone-800 shadow-sm backdrop-blur sm:text-sm md:hidden"
      aria-label="Open chapters"
      aria-expanded={expanded}
    >
      <MenuIcon className="size-4" />
      <span>Chapters</span>
    </button>
  );
}

export function ChapterDrawer({ chapters, currentSlug, initialProgress, open, onClose }: { chapters: ChapterNavItem[]; currentSlug: string; initialProgress: Record<string, ProgressState | undefined>; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Course chapters">
      <button className="absolute inset-0 h-full w-full cursor-default bg-stone-950/20" aria-label="Close chapters" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] max-w-full flex-col overflow-hidden rounded-r-[2rem] border-r border-stone-200 bg-[#f6f0e7] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Course map</p>
            <h2 className="mt-1 truncate text-xl font-semibold text-stone-950">Chapters</h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700">
            Close
          </button>
        </div>
        <ChapterLinks chapters={chapters} currentSlug={currentSlug} initialProgress={initialProgress} onNavigate={onClose} scrollable />
      </div>
    </div>
  );
}

export function ChapterNavigator({ chapters, currentSlug, initialProgress }: { chapters: ChapterNavItem[]; currentSlug: string; initialProgress: Record<string, ProgressState | undefined> }) {
  const [desktopOpen, setDesktopOpen] = useState(false);

  return (
    <aside className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-[46] hidden md:block lg:right-6" aria-label="Course chapters">
      {desktopOpen ? (
        <div className="pointer-events-auto flex max-h-[min(38rem,calc(100dvh-8rem))] w-[min(22rem,calc(100vw-2rem))] min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white/95 shadow-2xl shadow-stone-900/20 backdrop-blur">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-100 p-3">
            <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.25em] text-stone-500">Chapters</p>
            <button
              type="button"
              onClick={() => setDesktopOpen(false)}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 hover:border-amber-500 hover:text-amber-800"
              aria-label="Collapse chapters"
              aria-expanded={desktopOpen}
            >
              <MenuIcon className="size-4" />
            </button>
          </div>
          <ChapterLinks chapters={chapters} currentSlug={currentSlug} initialProgress={initialProgress} scrollable />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setDesktopOpen(true)}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-950 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-stone-900/25 transition hover:-translate-y-0.5 hover:bg-stone-800"
          aria-label="Expand chapters"
          aria-expanded={desktopOpen}
        >
          <MenuIcon className="size-4" />
          <span>Chapters</span>
        </button>
      )}
    </aside>
  );
}

function useLiveProgress(initialProgress: Record<string, ProgressState | undefined>) {
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

  return progressBySection;
}

function ChapterLinks({ chapters, currentSlug, initialProgress, onNavigate, scrollable = false }: { chapters: ChapterNavItem[]; currentSlug: string; initialProgress: Record<string, ProgressState | undefined>; onNavigate?: () => void; scrollable?: boolean }) {
  const progressBySection = useLiveProgress(initialProgress);
  return (
    <nav className={`grid gap-1 overflow-x-hidden p-3 text-sm ${scrollable ? "min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch]" : "overflow-y-visible"}`}>
      {chapters.map((item, index) => {
        const status = getChapterStatus(item.sectionIds, progressBySection);
        const meta = statusMeta[status];
        const active = item.slug === currentSlug;
        return (
          <Link
            key={item.slug}
            className={`group flex min-w-0 items-start gap-2 rounded-xl px-3 py-2.5 ${active ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"}`}
            href={`/course/${item.slug}`}
            onClick={onNavigate}
            aria-label={`${item.title}, ${meta.label}`}
          >
            <span className={`relative mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.68rem] font-semibold ${active ? "bg-white/15 text-white" : "bg-stone-100 text-stone-500 group-hover:bg-white"}`}>
              {index + 1}
              <span className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ${active ? `ring-stone-950 ${meta.mutedDot}` : `ring-white ${meta.dot}`}`} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 break-words leading-5">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}
