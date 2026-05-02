"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { formatDate } from "@/lib/format-date";

type Note = {
  id: string;
  sectionId: string;
  body: string;
  type: "note" | "highlight" | "question" | "voice";
  tags: string[];
  updatedAt: string;
};

type ProgressState = "unread" | "reading" | "completed" | "needs_review";

const progressLabels: Record<ProgressState, string> = {
  unread: "Unread",
  reading: "Currently viewing",
  completed: "Completed",
  needs_review: "Needs review",
};

const readingNotesActiveEvent = "reading-notes-active-section";

type ReadingNotesActiveEvent = CustomEvent<{ sectionId: string }>;

function isReadingBandInsideElement(element: Element) {
  const rect = element.getBoundingClientRect();
  const bandTop = window.innerHeight * 0.18;
  const bandBottom = window.innerHeight * 0.68;
  return rect.top <= bandBottom && rect.bottom >= bandTop;
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

export function NotePanel({
  sectionId,
  sectionTitle,
  initialNotes,
  initialProgress,
}: {
  sectionId: string;
  sectionTitle: string;
  initialNotes: Note[];
  initialProgress?: ProgressState;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [body, setBody] = useState("");
  const [type, setType] = useState<Note["type"]>("note");
  const [progress, setProgress] = useState<ProgressState>(initialProgress ?? "unread");
  const [message, setMessage] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isActiveSection, setIsActiveSection] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLElement | null>(null);
  const autoMarked = useRef(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const persistProgress = useCallback(
    (nextState: ProgressState, options?: { silent?: boolean }) => {
      setProgress(nextState);
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, state: nextState }),
      }).catch(() => {
        if (!options?.silent) setMessage("Progress will retry when you are online.");
      });
    },
    [sectionId],
  );

  useEffect(() => {
    loadDraft(sectionId).then((draft) => {
      if (draft) setBody((current) => current || draft);
    }).catch(() => undefined);
  }, [sectionId]);

  useEffect(() => {
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
    const section = panelRef.current?.closest("section");
    if (!section) return;

    function activateSection() {
      setIsActiveSection(true);
      window.dispatchEvent(new CustomEvent(readingNotesActiveEvent, { detail: { sectionId } }));
      if (autoMarked.current || progress !== "unread") return;
      autoMarked.current = true;
      persistProgress("reading", { silent: true });
    }

    if (isReadingBandInsideElement(section)) activateSection();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || !isReadingBandInsideElement(section)) return;
        activateSection();
      },
      {
        rootMargin: "-12% 0px -32% 0px",
        threshold: [0],
      },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [persistProgress, progress, sectionId]);

  useEffect(() => {
    function handleActiveSection(event: Event) {
      const activeSectionId = (event as ReadingNotesActiveEvent).detail?.sectionId;
      if (activeSectionId === sectionId) return;
      setIsActiveSection(false);
      setDrawerOpen(false);
    }

    window.addEventListener(readingNotesActiveEvent, handleActiveSection);
    return () => window.removeEventListener(readingNotesActiveEvent, handleActiveSection);
  }, [sectionId]);

  function saveNote(noteBody = body, noteType = type) {
    if (!noteBody.trim()) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId, body: noteBody, type: noteType, tags: [] }),
        });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Could not save note.");
          return;
        }
        setNotes((current) => [data.note, ...current]);
        setBody("");
        await deleteDraft(sectionId).catch(() => undefined);
        setMessage("Saved.");
      } catch {
        setMessage("Could not save note. Check your connection and try again.");
      }
    });
  }

  function updateProgress(nextState: ProgressState) {
    autoMarked.current = nextState === "reading";
    persistProgress(nextState);
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

    const recorder = new MediaRecorder(stream);
    chunks.current = [];
    recorder.ondataavailable = (event) => chunks.current.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "voice-note.webm");
      formData.append("sectionId", sectionId);
      setMessage("Transcribing voice note...");
      try {
        const response = await fetch("/api/transcribe", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) {
          setMessage(data.error ?? "Transcription failed.");
          return;
        }
        setBody((current) => [current, data.transcript].filter(Boolean).join("\n\n"));
        setType("voice");
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
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
            className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm"
          >
            <option value="unread">{progressLabels.unread}</option>
            <option value="reading">{progressLabels.reading}</option>
            <option value="completed">{progressLabels.completed}</option>
            <option value="needs_review">{progressLabels.needs_review}</option>
          </select>
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a note, question, or transcribed voice memo..."
          className="min-h-32 w-full resize-y rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base leading-6 outline-none ring-amber-500 transition focus:ring-2 sm:text-sm"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="sr-only" htmlFor={`note-type-${sectionId}-${mobile ? "mobile" : "desktop"}`}>
            Note type
          </label>
          <select
            id={`note-type-${sectionId}-${mobile ? "mobile" : "desktop"}`}
            value={type}
            onChange={(event) => setType(event.target.value as Note["type"])}
            className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm"
          >
            <option value="note">Note</option>
            <option value="question">Question</option>
            <option value="highlight">Highlight</option>
            <option value="voice">Voice</option>
          </select>
          <button
            disabled={pending || !body.trim()}
            onClick={() => saveNote()}
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={recording ? stopRecording : startRecording}
            className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
          >
            {recording ? "Stop recording" : "Voice note"}
          </button>
          {progress !== "completed" ? (
            <button
              onClick={() => updateProgress("completed")}
              className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900"
            >
              Mark complete
            </button>
          ) : null}
        </div>
        {message ? <p className="mt-3 rounded-2xl bg-stone-100 px-3 py-2 text-sm text-stone-600">{message}</p> : null}
        {notes.length ? (
          <div className="mt-5 max-h-72 space-y-3 overflow-auto pr-1">
            {notes.map((note) => (
              <article key={note.id} className="rounded-2xl bg-stone-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs uppercase tracking-wide text-stone-500">
                  <span>{note.type}</span>
                  <span>{formatDate(note.updatedAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-stone-800">{note.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone-500">No saved notes for this section yet.</p>
        )}
      </>
    );
  }

  return (
    <aside ref={panelRef} className="xl:sticky xl:top-24 xl:self-start">
      {isActiveSection && !drawerOpen ? (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[45] rounded-t-[1.75rem] rounded-b-[1.1rem] border border-stone-200 bg-white/95 px-4 py-3 text-left shadow-2xl shadow-stone-900/15 backdrop-blur xl:hidden"
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

      {isActiveSection && drawerOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label={`Reading notes for ${sectionTitle}`}>
          <button className="absolute inset-0 h-full w-full cursor-default bg-transparent" aria-label="Minimize reading notes" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] max-h-[82vh] overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl">
            <div className="p-4 pb-0">
              <button type="button" className="mx-auto block rounded-full px-8 py-2" aria-label="Minimize reading notes" onClick={() => setDrawerOpen(false)}>
                <span className="block h-1.5 w-12 rounded-full bg-stone-300" />
              </button>
              <div className="flex items-center justify-between gap-3 pb-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Reading notes</p>
                  <h2 className="mt-1 truncate text-lg font-semibold text-stone-950">{sectionTitle}</h2>
                  <p className="mt-1 text-sm text-stone-500">{notes.length ? `${notes.length} saved` : "No notes yet"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{progressLabels[progress]}</span>
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

      <div className="hidden rounded-[1.5rem] border border-stone-200 bg-white/90 p-4 shadow-sm xl:block">
        {renderPanelBody()}
      </div>
    </aside>
  );
}
