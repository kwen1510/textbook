"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format-date";

type NoteRow = {
  id: string;
  body: string;
  type: string;
  sectionId: string;
  updatedAt: Date | string;
  chapterTitle: string;
  sectionTitle: string;
  href: string;
};

export function NotesSearch({ notes }: { notes: NoteRow[] }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const noteTypes = useMemo(() => Array.from(new Set(notes.map((note) => note.type))).sort(), [notes]);
  const chapters = useMemo(() => Array.from(new Set(notes.map((note) => note.chapterTitle))).sort(), [notes]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return notes.filter((note) => {
      const matchesQuery = `${note.body} ${note.chapterTitle} ${note.sectionTitle} ${note.type}`.toLowerCase().includes(q);
      const matchesType = typeFilter === "all" || note.type === typeFilter;
      const matchesChapter = chapterFilter === "all" || note.chapterTitle === chapterFilter;
      return matchesQuery && matchesType && matchesChapter;
    });
  }, [chapterFilter, notes, query, typeFilter]);

  return (
    <div>
      <div className="mb-6 grid gap-3 rounded-[1.5rem] border border-stone-200 bg-white/80 p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_10rem_12rem]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes..." className="min-w-0 rounded-2xl border border-stone-200 bg-white px-5 py-4 outline-none ring-amber-500 focus:ring-2" />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none ring-amber-500 focus:ring-2">
          <option value="all">All types</option>
          {noteTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <select value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none ring-amber-500 focus:ring-2">
          <option value="all">All chapters</option>
          {chapters.map((chapter) => <option key={chapter} value={chapter}>{chapter}</option>)}
        </select>
      </div>
      <div className="grid gap-4">
        {filtered.map((note) => (
          <article key={note.id} className="rounded-[1.5rem] border border-stone-200 bg-white/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.22em] text-stone-500">
              <span>{note.chapterTitle}</span>
              <span>{note.type} · {formatDate(note.updatedAt)}</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-stone-950">{note.sectionTitle}</h2>
            <p className="mt-3 whitespace-pre-wrap leading-7 text-stone-700">{note.body}</p>
            <Link href={note.href} className="mt-4 inline-flex rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:border-amber-500 hover:text-amber-800">
              Open section
            </Link>
          </article>
        ))}
        {!filtered.length ? <p className="rounded-2xl bg-white/70 p-5 text-stone-500">No notes match this search.</p> : null}
      </div>
    </div>
  );
}
