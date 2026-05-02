"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

export function ReviewCard({ sectionId, chapterTitle, sectionTitle, prompt, href }: { sectionId: string; chapterTitle: string; sectionTitle: string; prompt: string; href: string }) {
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(rating: "again" | "hard" | "good" | "easy") {
    if (!answer.trim()) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/recall-attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId, prompt, answer, rating }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Could not save review.");
          return;
        }
        setAnswer("");
        setMessage("Review saved.");
      } catch {
        setMessage("Could not save review. Check your connection and try again.");
      }
    });
  }

  return (
    <article className="rounded-[1.5rem] border border-stone-200 bg-white/90 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">{chapterTitle}</p>
      <h2 className="mt-2 text-xl font-semibold text-stone-950">{sectionTitle}</h2>
      <p className="mt-3 leading-7 text-stone-700">{prompt}</p>
      <Link href={href} className="mt-3 inline-flex text-sm font-semibold text-amber-800 underline underline-offset-4">
        Open source section
      </Link>
      <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} className="mt-4 min-h-32 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none ring-amber-500 focus:ring-2" placeholder="Answer from memory before checking the source..." />
      <div className="mt-3 flex flex-wrap gap-2">
        {(["again", "hard", "good", "easy"] as const).map((rating) => <button key={rating} disabled={pending || !answer.trim()} onClick={() => submit(rating)} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold capitalize disabled:opacity-50">{rating}</button>)}
      </div>
      {message ? <p className="mt-3 text-sm text-stone-600">{message}</p> : null}
    </article>
  );
}
