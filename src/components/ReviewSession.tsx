"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import type { ReviewCardData, ReviewMode, ReviewRating } from "@/lib/review-cards";

type ReviewFilter = "mixed" | ReviewMode;

const ratings: { value: ReviewRating; label: string; meaning: string; schedule: string; className: string }[] = [
  { value: "again", label: "Again", meaning: "I missed it", schedule: "Returns in 30 min", className: "border-red-200 bg-red-50 text-red-800 hover:border-red-300" },
  { value: "hard", label: "Hard", meaning: "I needed help", schedule: "Returns tomorrow", className: "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300" },
  { value: "good", label: "Good", meaning: "I got the main idea", schedule: "Returns in 3 days", className: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300" },
  { value: "easy", label: "Easy", meaning: "I know this well", schedule: "Returns in 7 days", className: "border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300" },
];

function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}

export function ReviewSession({ cards }: { cards: ReviewCardData[] }) {
  const [filter, setFilter] = useState<ReviewFilter>("mixed");
  const filteredCards = useMemo(() => cards.filter((card) => filter === "mixed" || card.mode === filter), [cards, filter]);
  const [index, setIndex] = useState(0);
  const currentIndex = Math.min(index, Math.max(filteredCards.length - 1, 0));
  const card = filteredCards[currentIndex];
  const [answer, setAnswer] = useState("");
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [savingRating, setSavingRating] = useState<ReviewRating | null>(null);
  const [pending, startTransition] = useTransition();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  function resetForNext(nextIndex = index) {
    setIndex(nextIndex);
    setAnswer("");
    setSelectedChoiceId(null);
    setRevealed(false);
    setMessage(null);
    setAiQuestion("");
    setAiAnswer(null);
    setSavingRating(null);
  }

  function changeFilter(nextFilter: ReviewFilter) {
    setFilter(nextFilter);
    resetForNext(0);
  }

  function submit(rating: ReviewRating) {
    if (!card) return;
    const responseText = card.mode === "mcq"
      ? selectedChoiceId
        ? `Selected ${selectedChoiceId}: ${card.choices?.find((choice) => choice.id === selectedChoiceId)?.text ?? "Unknown choice"}`
        : "Reviewed answer without selecting a choice."
      : answer.trim() || "Reviewed suggested answer without typing a response.";

    setMessage(null);
    setSavingRating(rating);
    startTransition(async () => {
      try {
        const response = await fetch("/api/recall-attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId: card.sectionId, prompt: card.question, answer: responseText, rating, mode: card.mode }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Could not save review.");
          setSavingRating(null);
          return;
        }
        const nextIndex = Math.min(currentIndex + 1, filteredCards.length - 1);
        if (nextIndex === currentIndex) {
          const selectedRating = ratings.find((option) => option.value === rating);
          setMessage(`Review saved. ${selectedRating?.schedule ?? "The next review has been scheduled."} You reached the end of this deck.`);
          setRevealed(true);
          setSavingRating(null);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 180));
        resetForNext(nextIndex);
      } catch {
        setMessage("Could not save review. Check your connection and try again.");
        setSavingRating(null);
      }
    });
  }

  async function startRecording() {
    if (!card) return;
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Voice answers are not supported in this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessage("Microphone access was blocked or unavailable.");
      return;
    }

    const recorder = new MediaRecorder(stream);
    chunks.current = [];
    recorder.ondataavailable = (event) => chunks.current.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "review-answer.webm");
      formData.append("sectionId", card.sectionId);
      setMessage("Transcribing your answer...");
      try {
        const response = await fetch("/api/transcribe", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Transcription failed.");
          return;
        }
        const transcript = (data.transcript ?? "").trim();
        if (!transcript) {
          setMessage("No speech was detected.");
          return;
        }
        setAnswer((current) => [current, transcript].filter(Boolean).join("\n\n"));
        setMessage("Transcript added. You can edit it before reviewing.");
      } catch {
        setMessage("Transcription failed. Check your connection and try again.");
      }
    };
    mediaRecorder.current = recorder;
    recorder.start();
    setRecording(true);
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
  }

  function askFollowUp() {
    if (!card || !aiQuestion.trim()) return;
    setAiAnswer(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/study-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "chat",
            sectionId: card.sectionId,
            selectedText: `Review question: ${card.question}\n\nSuggested answer: ${card.suggestedAnswer}\n\nMy answer: ${answer || selectedChoiceId || "No answer yet"}`,
            question: aiQuestion,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setAiAnswer(data.error ?? "The assistant could not respond.");
          return;
        }
        setAiAnswer(data.answer ?? "No answer returned.");
      } catch {
        setAiAnswer("The assistant could not respond. Check your connection and try again.");
      }
    });
  }

  if (!card) {
    return <p className="rounded-2xl bg-white/80 p-5 text-stone-600">No review cards are available for this mode.</p>;
  }

  const isCorrect = card.mode === "mcq" && selectedChoiceId === card.correctChoiceId;

  return (
    <section className="grid min-w-0 gap-5 overflow-x-clip">
      <div className="flex flex-wrap gap-2">
        {(["mixed", "open", "mcq"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => changeFilter(mode)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize ${filter === mode ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 bg-white/80 text-stone-700"}`}
          >
            {mode === "mcq" ? "MCQ" : mode}
          </button>
        ))}
      </div>

      <article className={`min-w-0 overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white/90 p-5 shadow-sm transition-all duration-200 sm:p-6 ${savingRating ? "translate-y-3 scale-[0.985] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500 sm:tracking-[0.22em]">
          <span className="min-w-0 break-words">{card.mode === "mcq" ? "MCQ" : "Open"} - {card.difficulty}</span>
          <span className="shrink-0">{currentIndex + 1}/{filteredCards.length}</span>
        </div>
        <p className="mt-4 break-words text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">{card.chapterTitle}</p>
        <h2 className="mt-2 break-words text-2xl font-semibold tracking-tight text-stone-950">{card.sectionTitle}</h2>
        {card.scenario ? <p className="mt-4 break-words rounded-2xl bg-amber-50 px-4 py-3 leading-7 text-amber-950">{card.scenario}</p> : null}
        <p className="mt-4 break-words text-xl font-semibold leading-8 text-stone-950">{card.question}</p>

        {card.mode === "mcq" ? (
          <div className="mt-5 grid gap-2">
            {card.choices?.map((choice) => {
              const selected = selectedChoiceId === choice.id;
              const correct = revealed && choice.id === card.correctChoiceId;
              const wrong = revealed && selected && choice.id !== card.correctChoiceId;
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={revealed}
                  onClick={() => setSelectedChoiceId(choice.id)}
                  className={`min-w-0 rounded-2xl border px-4 py-3 text-left transition ${correct ? "border-emerald-300 bg-emerald-50 text-emerald-950" : wrong ? "border-red-300 bg-red-50 text-red-950" : selected ? "border-amber-400 bg-amber-50 text-stone-950" : "border-stone-200 bg-white text-stone-700 hover:border-amber-400"}`}
                >
                  <span className="mr-2 font-semibold">{choice.id}.</span><span className="break-words">{choice.text}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className="min-h-40 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 leading-7 outline-none ring-amber-500 focus:ring-2"
              placeholder="Type your answer from memory, or use the mic to dictate..."
            />
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              aria-pressed={recording}
              className={`relative inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${recording ? "bg-red-600 text-white shadow-[0_0_0_4px_rgba(248,113,113,0.16),0_12px_28px_rgba(220,38,38,0.18)]" : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"}`}
            >
              <MicIcon className="size-4" />
              {recording ? "Recording... tap to stop" : "Voice answer"}
            </button>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Review answer
          </button>
          <Link href={card.href} className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:border-amber-500 hover:text-amber-800">
            Open source
          </Link>
        </div>

        {revealed ? (
          <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
            {card.mode === "mcq" ? <p className={`mb-3 font-semibold ${isCorrect ? "text-emerald-700" : selectedChoiceId ? "text-red-700" : "text-stone-600"}`}>{selectedChoiceId ? (isCorrect ? "Correct." : "Not quite.") : "Answer shown."}</p> : null}
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Suggested answer</p>
            <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-stone-800">{card.suggestedAnswer}</p>
            {card.keyPoints.length ? (
              <ul className="mt-4 grid gap-2 text-sm text-stone-700">
                {card.keyPoints.slice(0, 4).map((point) => <li key={point} className="break-words rounded-xl bg-white px-3 py-2">{point}</li>)}
              </ul>
            ) : null}
            <p className="mt-4 text-sm font-medium text-stone-600">{card.sourceHint}</p>
            <div className="mt-4 rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-stone-900">How well did you recall it?</p>
              <p className="mt-1 text-sm leading-6 text-stone-600">Your choice saves this attempt, schedules the next review, and moves this card out of the current deck.</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {ratings.map((rating) => (
                <button
                  key={rating.value}
                  disabled={pending}
                  onClick={() => submit(rating.value)}
                  className={`rounded-2xl border px-4 py-3 text-left transition disabled:opacity-50 ${rating.className}`}
                >
                  <span className="block text-base font-semibold">{rating.label} - {rating.meaning}</span>
                  <span className="mt-1 block text-sm opacity-80">{rating.schedule}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {revealed ? (
          <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Ask a follow-up</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} className="min-w-0 flex-1 rounded-full border border-stone-200 px-4 py-2 outline-none ring-amber-500 focus:ring-2" placeholder="Ask about the answer or source section..." />
              <button disabled={pending || !aiQuestion.trim()} onClick={askFollowUp} className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 disabled:opacity-50">Ask</button>
            </div>
            {aiAnswer ? <p className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-6 text-stone-700">{aiAnswer}</p> : null}
          </div>
        ) : null}

        {message ? <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-600">{message}</p> : null}
      </article>
    </section>
  );
}
