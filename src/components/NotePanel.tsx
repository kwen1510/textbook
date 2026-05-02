"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatDate } from "@/lib/format-date";
import {
  readingNotesActiveEvent,
  readingNotesAddHighlightEvent,
  readingNotesProgressEvent,
  type ReadingNotesActiveDetail,
  type ReadingNotesAddHighlightDetail,
  type ReadingNotesProgressDetail,
} from "@/lib/reading-notes-events";

type Note = {
  id: string;
  sectionId: string;
  body: string;
  quote?: string | null;
  type: "note" | "highlight" | "question" | "voice";
  tags: string[];
  updatedAt: string;
};

type ProgressState = "unread" | "reading" | "completed" | "needs_review";

type NotePanelSection = {
  id: string;
  title: string;
  slug: string;
  initialNotes: Note[];
  initialProgress?: ProgressState;
};

const progressLabels: Record<ProgressState, string> = {
  unread: "Unread",
  reading: "Currently viewing",
  completed: "Completed",
  needs_review: "For review",
};

function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}

function noteKindLabel(type: Note["type"]) {
  if (type === "highlight") return "Highlighted note";
  if (type === "question") return "Assistant explanation";
  if (type === "voice") return "Voice note";
  return "Page note";
}

function splitHighlightBody(note: Note) {
  if (note.type !== "highlight" && note.type !== "question") return { highlight: "", noteText: note.body };
  if (note.quote?.trim()) return { highlight: note.quote.trim(), noteText: note.body };
  const lines = note.body.split("\n");
  const quoteLines: string[] = [];
  while (lines[0]?.startsWith(">")) {
    quoteLines.push(lines.shift()!.replace(/^>\s?/, ""));
  }
  const highlight = quoteLines.join("\n").trim() || note.body.trim();
  const noteText = quoteLines.length ? lines.join("\n").trim() : "";
  return { highlight, noteText };
}

function NoteBody({ note }: { note: Note }) {
  const { highlight, noteText } = splitHighlightBody(note);
  if (note.type !== "highlight" && note.type !== "question") {
    return <p className="whitespace-pre-wrap break-words text-sm leading-6 text-stone-800">{note.body}</p>;
  }
  return (
    <div className="space-y-3">
      <blockquote className="break-words rounded-xl border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
        {highlight}
      </blockquote>
      {noteText ? <p className="whitespace-pre-wrap break-words text-sm leading-6 text-stone-800">{noteText}</p> : null}
    </div>
  );
}

function isReadingBandInsideElement(element: Element) {
  const rect = element.getBoundingClientRect();
  const bandTop = window.innerHeight * 0.18;
  const bandBottom = window.innerHeight * 0.68;
  return rect.top <= bandBottom && rect.bottom >= bandTop;
}

function isPastReadingBand(element: Element) {
  return element.getBoundingClientRect().bottom < window.innerHeight * 0.18;
}

function unwrapExistingHighlights() {
  document.querySelectorAll("mark[data-book-highlight='true']").forEach((mark) => {
    const text = document.createTextNode(mark.textContent ?? "");
    mark.replaceWith(text);
    text.parentElement?.normalize();
  });
}

function markFirstTextMatch(container: HTMLElement, quote: string) {
  const needle = quote.replace(/\s+/g, " ").trim();
  if (needle.length < 3) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("mark, script, style, textarea, input")) return NodeFilter.FILTER_REJECT;
      return node.textContent?.replace(/\s+/g, " ").toLowerCase().includes(needle.toLowerCase())
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });
  const node = walker.nextNode();
  if (!node?.textContent) return;
  const index = node.textContent.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return;
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + needle.length);
  const mark = document.createElement("mark");
  mark.dataset.bookHighlight = "true";
  mark.className = "rounded bg-amber-200/70 px-0.5 text-inherit";
  range.surroundContents(mark);
}

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("textbook", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveDraft(key: string, value: string) {
  const db = await openDraftDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteDraft(key: string) {
  const db = await openDraftDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("drafts", "readwrite");
    tx.objectStore("drafts").delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDraft(key: string): Promise<string | null> {
  const db = await openDraftDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("drafts", "readonly");
    const request = tx.objectStore("drafts").get(key);
    request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

function getInitialNotesBySection(sections: NotePanelSection[]) {
  return Object.fromEntries(sections.map((section) => [section.id, section.initialNotes])) as Record<string, Note[]>;
}

function getInitialProgressBySection(sections: NotePanelSection[]) {
  return Object.fromEntries(sections.map((section) => [section.id, section.initialProgress ?? "unread"])) as Record<string, ProgressState>;
}

export function NotePanel({ sections }: { sections: NotePanelSection[] }) {
  const firstSectionId = sections[0]?.id ?? "";
  const [activeSectionId, setActiveSectionId] = useState(firstSectionId);
  const [notesBySection, setNotesBySection] = useState<Record<string, Note[]>>(() => getInitialNotesBySection(sections));
  const [draftsBySection, setDraftsBySection] = useState<Record<string, string>>({});
  const [quotesBySection, setQuotesBySection] = useState<Record<string, string>>({});
  const [typeBySection, setTypeBySection] = useState<Record<string, Note["type"]>>({});
  const [progressBySection, setProgressBySection] = useState<Record<string, ProgressState>>(() => getInitialProgressBySection(sections));
  const [message, setMessage] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [pending, startTransition] = useTransition();
  const autoMarked = useRef(new Set<string>());
  const autoCompleteSuppressed = useRef(new Set<string>());
  const activeSectionRef = useRef(firstSectionId);
  const progressRef = useRef(progressBySection);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordingSectionId = useRef<string>(firstSectionId);
  const chunks = useRef<Blob[]>([]);

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? sections[0],
    [activeSectionId, sections],
  );
  const sectionId = activeSection?.id ?? "";
  const sectionTitle = activeSection?.title ?? "Reading notes";
  const notes = notesBySection[sectionId] ?? [];
  const body = draftsBySection[sectionId] ?? "";
  const quote = quotesBySection[sectionId] ?? "";
  const type = typeBySection[sectionId] ?? "note";
  const progress = progressBySection[sectionId] ?? "unread";

  const setBody = useCallback((updater: string | ((current: string) => string), targetSectionId = sectionId) => {
    setDraftsBySection((current) => {
      const currentBody = current[targetSectionId] ?? "";
      const nextBody = typeof updater === "function" ? updater(currentBody) : updater;
      return { ...current, [targetSectionId]: nextBody };
    });
  }, [sectionId]);

  const setType = useCallback((nextType: Note["type"], targetSectionId = sectionId) => {
    setTypeBySection((current) => ({ ...current, [targetSectionId]: nextType }));
  }, [sectionId]);

  const setQuote = useCallback((nextQuote: string, targetSectionId = sectionId) => {
    setQuotesBySection((current) => ({ ...current, [targetSectionId]: nextQuote }));
  }, [sectionId]);

  const persistProgress = useCallback((targetSectionId: string, nextState: ProgressState, options?: { silent?: boolean }) => {
    setProgressBySection((current) => ({ ...current, [targetSectionId]: nextState }));
    progressRef.current = { ...progressRef.current, [targetSectionId]: nextState };
    window.dispatchEvent(new CustomEvent<ReadingNotesProgressDetail>(readingNotesProgressEvent, { detail: { sectionId: targetSectionId, state: nextState } }));
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId: targetSectionId, state: nextState }),
    }).catch(() => {
      if (!options?.silent) setMessage("Progress will retry when you are online.");
    });
  }, []);

  const activateSection = useCallback((nextSectionId: string, options?: { openDrawer?: boolean }) => {
    if (!nextSectionId) return;
    const alreadyActive = activeSectionRef.current === nextSectionId;
    if (!alreadyActive) {
      activeSectionRef.current = nextSectionId;
      setActiveSectionId(nextSectionId);
      setMessage(null);
      setEditingId(null);
      setEditBody("");
      window.dispatchEvent(new CustomEvent<ReadingNotesActiveDetail>(readingNotesActiveEvent, { detail: { sectionId: nextSectionId } }));
    }
    if (options?.openDrawer) setDrawerOpen(true);
    if (autoMarked.current.has(nextSectionId) || progressRef.current[nextSectionId] !== "unread") return;
    autoMarked.current.add(nextSectionId);
    persistProgress(nextSectionId, "reading", { silent: true });
  }, [persistProgress]);

  useEffect(() => {
    const articles = Array.from(document.querySelectorAll<HTMLElement>("[data-course-section-id]"));
    if (!articles.length) return;

    function pickActive() {
      const active = articles
        .filter(isReadingBandInsideElement)
        .sort((a, b) => Math.abs(a.getBoundingClientRect().top - window.innerHeight * 0.22) - Math.abs(b.getBoundingClientRect().top - window.innerHeight * 0.22))[0];
      const id = active?.dataset.courseSectionId;
      if (id) {
        autoCompleteSuppressed.current.delete(id);
        activateSection(id);
      }

      for (const article of articles) {
        const sectionId = article.dataset.courseSectionId;
        if (!sectionId || !isPastReadingBand(article) || autoCompleteSuppressed.current.has(sectionId)) continue;
        const currentState = progressRef.current[sectionId] ?? "unread";
        if (currentState !== "reading") continue;
        persistProgress(sectionId, "completed", { silent: true });
      }
    }

    const observer = new IntersectionObserver(pickActive, {
      rootMargin: "-12% 0px -32% 0px",
      threshold: [0, 0.2, 0.45, 0.7],
    });

    articles.forEach((article) => observer.observe(article));
    pickActive();
    window.addEventListener("hashchange", pickActive);
    window.addEventListener("scroll", pickActive, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", pickActive);
      window.removeEventListener("scroll", pickActive);
    };
  }, [activateSection, persistProgress]);

  useEffect(() => {
    if (!sectionId || draftsBySection[sectionId] !== undefined) return;
    loadDraft(sectionId).then((draft) => {
      if (!draft) return;
      setDraftsBySection((current) => current[sectionId] === undefined ? { ...current, [sectionId]: draft } : current);
      if (draft.trimStart().startsWith(">")) setType("highlight", sectionId);
    }).catch(() => undefined);
  }, [draftsBySection, sectionId, setType]);

  useEffect(() => {
    if (!sectionId) return;
    const timeout = window.setTimeout(() => {
      if (body) {
        saveDraft(sectionId, body).catch(() => undefined);
      } else {
        deleteDraft(sectionId).catch(() => undefined);
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [body, sectionId]);

  useEffect(() => {
    function handleAddHighlight(event: Event) {
      const detail = (event as CustomEvent<ReadingNotesAddHighlightDetail>).detail;
      if (!detail?.sectionId || !detail.text) return;
      activateSection(detail.sectionId, { openDrawer: true });
      setType("highlight", detail.sectionId);
      setQuote(detail.text, detail.sectionId);
      setBody("", detail.sectionId);
      setMessage("Highlight attached. Add your note below, then save.");
    }

    window.addEventListener(readingNotesAddHighlightEvent, handleAddHighlight);
    return () => window.removeEventListener(readingNotesAddHighlightEvent, handleAddHighlight);
  }, [activateSection, setBody, setQuote, setType]);

  useEffect(() => {
    unwrapExistingHighlights();
    for (const [highlightSectionId, sectionNotes] of Object.entries(notesBySection)) {
      const article = document.querySelector<HTMLElement>(`[data-course-section-id="${CSS.escape(highlightSectionId)}"]`);
      if (!article) continue;
      const quotes = sectionNotes
        .filter((note) => note.type === "highlight")
        .map((note) => splitHighlightBody(note).highlight)
        .filter(Boolean);
      const pendingQuote = quotesBySection[highlightSectionId]?.trim();
      if (pendingQuote) quotes.unshift(pendingQuote);
      for (const savedQuote of quotes.slice(0, 8)) markFirstTextMatch(article, savedQuote);
    }
  }, [notesBySection, quotesBySection]);

  function saveNote(noteBody = body, noteType = type, targetSectionId = sectionId, noteQuote = quote) {
    if ((!noteBody.trim() && !noteQuote.trim()) || !targetSectionId) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId: targetSectionId, body: noteBody, quote: noteQuote || undefined, type: noteQuote ? "highlight" : noteType, tags: [] }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Could not save note.");
          return;
        }
        setNotesBySection((current) => ({ ...current, [targetSectionId]: [data.note, ...(current[targetSectionId] ?? [])] }));
        setDraftsBySection((current) => ({ ...current, [targetSectionId]: "" }));
        setQuotesBySection((current) => ({ ...current, [targetSectionId]: "" }));
        setType("note", targetSectionId);
        await deleteDraft(targetSectionId).catch(() => undefined);
        setMessage("Saved.");
      } catch {
        setMessage("Could not save note. Check your connection and try again.");
      }
    });
  }

  function updateProgress(nextState: ProgressState) {
    if (!sectionId) return;
    if (nextState === "reading") {
      autoMarked.current.add(sectionId);
      autoCompleteSuppressed.current.add(sectionId);
    } else {
      autoCompleteSuppressed.current.delete(sectionId);
    }
    persistProgress(sectionId, nextState);
  }

  function toggleCompletion() {
    updateProgress(progress === "completed" ? "reading" : "completed");
  }

  function beginEdit(note: Note) {
    setMessage(null);
    setEditingId(note.id);
    setEditBody(note.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody("");
  }

  function saveEdit(noteId: string) {
    const noteBeingEdited = notes.find((note) => note.id === noteId);
    if (!editBody.trim() && !noteBeingEdited?.quote?.trim()) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: editBody }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Could not update note.");
          return;
        }
        setNotesBySection((current) => ({
          ...current,
          [sectionId]: (current[sectionId] ?? []).map((note) => note.id === noteId ? { ...note, body: data.note.body, quote: data.note.quote, updatedAt: data.note.updatedAt } : note),
        }));
        cancelEdit();
        setMessage("Note updated.");
      } catch {
        setMessage("Could not update note. Check your connection and try again.");
      }
    });
  }

  function deleteSavedNote(noteId: string) {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Could not delete note.");
          return;
        }
        setNotesBySection((current) => ({ ...current, [sectionId]: (current[sectionId] ?? []).filter((note) => note.id !== noteId) }));
        if (editingId === noteId) cancelEdit();
        setMessage("Note deleted.");
      } catch {
        setMessage("Could not delete note. Check your connection and try again.");
      }
    });
  }

  async function startRecording() {
    setMessage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Voice notes are not supported in this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessage("Microphone access was blocked or unavailable.");
      return;
    }

    const targetSectionId = sectionId;
    recordingSectionId.current = targetSectionId;
    const recorder = new MediaRecorder(stream);
    chunks.current = [];
    recorder.ondataavailable = (event) => chunks.current.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "voice-note.webm");
      formData.append("sectionId", recordingSectionId.current);
      setMessage("Transcribing voice note...");
      try {
        const response = await fetch("/api/transcribe", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Transcription failed.");
          return;
        }
        setType("voice", recordingSectionId.current);
        setBody((current) => [current, data.transcript].filter(Boolean).join("\n\n"), recordingSectionId.current);
        setMessage("Transcript added as an editable draft.");
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

  function renderPanelBody(mobile = false) {
    return (
      <>
        <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">Reading notes</p>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-stone-800">{sectionTitle}</p>
          </div>
          <label className="sr-only" htmlFor={`progress-${sectionId}-${mobile ? "mobile" : "desktop"}`}>
            Learning state
          </label>
          <select
            id={`progress-${sectionId}-${mobile ? "mobile" : "desktop"}`}
            value={progress}
            onChange={(event) => updateProgress(event.target.value as ProgressState)}
            className="max-w-full rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm"
          >
            <option value="unread">{progressLabels.unread}</option>
            <option value="reading">{progressLabels.reading}</option>
            <option value="completed">{progressLabels.completed}</option>
            <option value="needs_review">{progressLabels.needs_review}</option>
          </select>
        </div>
        {quote ? (
          <div className="mb-3 rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-stone-500">Highlighted text</p>
            <p className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-stone-700">{quote}</p>
            <button type="button" onClick={() => setQuote("")} className="mt-2 text-xs font-semibold text-stone-500 underline underline-offset-4">
              Remove highlight
            </button>
          </div>
        ) : null}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={quote ? "Write your note about the highlighted text..." : "Write a note for this section, or use the mic to dictate..."}
          className="min-h-32 w-full resize-y rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base leading-6 outline-none ring-amber-500 transition focus:ring-2 sm:text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={pending || (!body.trim() && !quote.trim())}
            onClick={() => saveNote()}
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={recording ? stopRecording : startRecording}
            aria-pressed={recording}
            className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${recording ? "bg-red-600 text-white shadow-lg shadow-red-500/40 ring-4 ring-red-200" : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"}`}
          >
            {recording ? <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-red-400/40" /> : null}
            <MicIcon className="size-4" />
            {recording ? "Recording... tap to stop" : "Voice note"}
          </button>
          <button
            onClick={toggleCompletion}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${progress === "completed" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-emerald-300 bg-emerald-50 text-emerald-900"}`}
          >
            {progress === "completed" ? "Set in progress" : "Mark complete"}
          </button>
        </div>
        {message ? <p className="mt-3 rounded-2xl bg-stone-100 px-3 py-2 text-sm text-stone-600">{message}</p> : null}
        {notes.length ? (
          <div className="mt-5 max-h-72 min-w-0 space-y-3 overflow-auto pr-1">
            {notes.map((note) => (
              <article key={note.id} className="min-w-0 overflow-hidden rounded-2xl bg-stone-100 p-3">
                <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-stone-500">
                  <span className="min-w-0 break-words">{noteKindLabel(note.type)}</span>
                  <span className="shrink-0">{formatDate(note.updatedAt)}</span>
                </div>
                {editingId === note.id ? (
                  <div className="grid gap-2">
                    {note.quote ? (
                      <blockquote className="break-words rounded-xl border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
                        {note.quote}
                      </blockquote>
                    ) : null}
                    <textarea
                      value={editBody}
                      onChange={(event) => setEditBody(event.target.value)}
                      className="min-h-28 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm leading-6 outline-none ring-amber-500 focus:ring-2"
                      aria-label="Edit note body"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button disabled={pending || (!editBody.trim() && !note.quote?.trim())} onClick={() => saveEdit(note.id)} className="rounded-full bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                        Save
                      </button>
                      <button disabled={pending} onClick={cancelEdit} className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <NoteBody note={note} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button disabled={pending} onClick={() => beginEdit(note)} className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700">
                        Edit
                      </button>
                      <button disabled={pending} onClick={() => deleteSavedNote(note.id)} className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone-500">No saved notes for this section yet.</p>
        )}
      </>
    );
  }

  if (!activeSection) return null;

  return (
    <aside className="min-w-0 xl:w-96 xl:self-start">
      {!drawerOpen ? (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[45] max-w-[calc(100vw-2rem)] rounded-t-[1.75rem] rounded-b-[1.1rem] border border-stone-200 bg-white/95 px-4 py-3 text-left shadow-2xl shadow-stone-900/15 backdrop-blur xl:hidden"
          aria-expanded={false}
        >
          <span className="mx-auto mb-2 block h-1.5 w-12 rounded-full bg-stone-300" />
          <span className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Reading notes</span>
              <span className="mt-1 block truncate text-sm font-medium text-stone-800">{notes.length ? `${notes.length} saved for ${sectionTitle}` : `No notes yet · ${sectionTitle}`}</span>
            </span>
            <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{progressLabels[progress]}</span>
          </span>
        </button>
      ) : null}

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label={`Reading notes for ${sectionTitle}`}>
          <button className="absolute inset-0 h-full w-full cursor-default bg-transparent" aria-label="Minimize reading notes" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] max-h-[82vh] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl">
            <div className="p-4 pb-0">
              <button type="button" className="mx-auto block rounded-full px-8 py-2" aria-label="Minimize reading notes" onClick={() => setDrawerOpen(false)}>
                <span className="block h-1.5 w-12 rounded-full bg-stone-300" />
              </button>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 pb-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Reading notes</p>
                  <h2 className="mt-1 truncate text-lg font-semibold text-stone-950">{sectionTitle}</h2>
                  <p className="mt-1 text-sm text-stone-500">{notes.length ? `${notes.length} saved` : "No notes yet"}</p>
                </div>
                <div className="flex min-w-0 shrink-0 items-center gap-2">
                  <span className="max-w-[10rem] truncate rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{progressLabels[progress]}</span>
                  <button type="button" onClick={() => setDrawerOpen(false)} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white">
                    Close
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-[calc(82vh-7.5rem)] overflow-auto border-t border-stone-100 p-4">
              {renderPanelBody(true)}
            </div>
          </div>
        </div>
      ) : null}

      <div className="hidden max-h-[calc(100vh-6.5rem)] overflow-auto rounded-[1.5rem] border border-stone-200 bg-white/90 p-4 shadow-sm xl:fixed xl:right-[max(1.5rem,calc((100vw-96rem)/2+1.5rem))] xl:top-[5.75rem] xl:z-20 xl:block xl:w-96">
        {renderPanelBody()}
      </div>
    </aside>
  );
}
