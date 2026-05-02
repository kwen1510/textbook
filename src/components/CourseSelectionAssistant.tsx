"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readingNotesAddHighlightEvent } from "@/lib/reading-notes-events";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

type SelectionState = {
  text: string;
  sectionId: string;
  sectionTitle: string;
  x: number;
  y: number;
};

function getElementFromSelection(selection: Selection) {
  const node = selection.anchorNode;
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function CourseSelectionAssistant() {
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [activeSection, setActiveSection] = useState<{ sectionId: string; sectionTitle: string } | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);

  const googleSearchUrl = useMemo(() => {
    if (!selectionState?.text) return "";
    return `https://www.google.com/search?q=${encodeURIComponent(selectionState.text)}`;
  }, [selectionState]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewportMode = () => setIsNarrowViewport(mediaQuery.matches);
    updateViewportMode();
    mediaQuery.addEventListener("change", updateViewportMode);
    return () => mediaQuery.removeEventListener("change", updateViewportMode);
  }, []);

  useEffect(() => {
    function updateSelection() {
      const selection = window.getSelection();
      const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
      if (!selection || text.length < 2 || selection.rangeCount === 0) {
        setSelectionState(null);
        return;
      }

      const element = getElementFromSelection(selection);
      const article = element?.closest<HTMLElement>("[data-course-section-id]");
      if (!article) {
        setSelectionState(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) return;

      setSelectionState({
        text: text.slice(0, 12000),
        sectionId: article.dataset.courseSectionId ?? "",
        sectionTitle: article.dataset.courseSectionTitle ?? "Current section",
        x: Math.min(Math.max(rect.left + rect.width / 2, 96), window.innerWidth - 96),
        y: Math.max(rect.top - 56, 76),
      });
    }

    function clearOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectionState(null);
    }

    function clearOnScroll() {
      setSelectionState(null);
    }

    document.addEventListener("mouseup", updateSelection);
    document.addEventListener("keyup", updateSelection);
    document.addEventListener("selectionchange", updateSelection);
    window.addEventListener("scroll", clearOnScroll, { passive: true });
    window.addEventListener("keydown", clearOnEscape);
    return () => {
      document.removeEventListener("mouseup", updateSelection);
      document.removeEventListener("keyup", updateSelection);
      document.removeEventListener("selectionchange", updateSelection);
      window.removeEventListener("scroll", clearOnScroll);
      window.removeEventListener("keydown", clearOnEscape);
    };
  }, []);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-course-section-id]"));
    if (!sections.length) return;

    const ratios = new Map<Element, number>();
    const setFallbackActiveSection = () => {
      const nearest = sections
        .map((section) => ({ section, distance: Math.abs(section.getBoundingClientRect().top - 140) }))
        .sort((a, b) => a.distance - b.distance)[0]?.section;
      if (!nearest) return;
      setActiveSection({
        sectionId: nearest.dataset.courseSectionId ?? "",
        sectionTitle: nearest.dataset.courseSectionTitle ?? "Current section",
      });
    };

    setFallbackActiveSection();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.set(entry.target, entry.intersectionRatio);
        const active = sections
          .map((section) => ({ section, ratio: ratios.get(section) ?? 0, top: Math.abs(section.getBoundingClientRect().top - 140) }))
          .sort((a, b) => b.ratio - a.ratio || a.top - b.top)[0]?.section;
        if (!active) return;
        setActiveSection({
          sectionId: active.dataset.courseSectionId ?? "",
          sectionTitle: active.dataset.courseSectionTitle ?? "Current section",
        });
      },
      { rootMargin: "-12% 0px -55% 0px", threshold: [0, 0.2, 0.45, 0.7] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function openPanel(nextSelection = selectionState) {
    const nextSectionId = nextSelection?.sectionId || activeSection?.sectionId;
    const nextSectionTitle = nextSelection?.sectionTitle || activeSection?.sectionTitle || "Current section";
    if (!nextSectionId) return;
    setSelectedText(nextSelection?.text ?? "");
    setSectionId(nextSectionId);
    setSectionTitle(nextSectionTitle);
    setPanelOpen(true);
  }

  function askAssistant(mode: "explain" | "chat", nextQuestion?: string) {
    const text = selectedText || selectionState?.text;
    const activeSectionId = sectionId || selectionState?.sectionId || activeSection?.sectionId;
    const activeSectionTitle = sectionTitle || selectionState?.sectionTitle || activeSection?.sectionTitle || "Current section";
    if (!activeSectionId || (mode === "explain" && !text)) return;

    openPanel(selectionState ?? { text: text ?? "", sectionId: activeSectionId, sectionTitle: activeSectionTitle, x: 0, y: 0 });
    setError(null);

    const userContent = mode === "explain" ? `Explain: ${text}` : nextQuestion?.trim() ?? "";
    if (!userContent) return;

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", content: userContent }];
    setMessages(nextMessages);
    setQuestion("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/study-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            selectedText: text,
            sectionId: activeSectionId,
            question: nextQuestion,
            history: messages.slice(-6),
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Could not get an explanation.");
          return;
        }
        setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
        if (data.saved) setVoiceMessage("Saved to Notes for later review.");
      } catch {
        setError("Could not reach the study assistant. Check your connection and try again.");
      }
    });
  }

  function startChat() {
    openPanel();
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  function addSelectionNote() {
    if (!selectionState?.sectionId || !selectionState.text) return;
    window.dispatchEvent(new CustomEvent(readingNotesAddHighlightEvent, {
      detail: {
        sectionId: selectionState.sectionId,
        sectionTitle: selectionState.sectionTitle,
        text: selectionState.text,
      },
    }));
    setSelectionState(null);
    window.getSelection()?.removeAllRanges();
  }

  async function startRecording() {
    setError(null);
    setVoiceMessage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceMessage("Voice input is not supported in this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceMessage("Microphone access was blocked or unavailable.");
      return;
    }
    streamRef.current = stream;

    const recorder = new MediaRecorder(stream);
    chunks.current = [];
    recorder.ondataavailable = (event) => chunks.current.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const blob = new Blob(chunks.current, { type: recorder.mimeType || "audio/webm" });
      const formData = new FormData();
      formData.append("audio", blob, "assistant-question.webm");
      const activeSectionId = sectionId || activeSection?.sectionId;
      if (activeSectionId) formData.append("sectionId", activeSectionId);
      setVoiceMessage("Transcribing voice question...");
      try {
        const response = await fetch("/api/transcribe", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) {
          setVoiceMessage(data.error ?? "Transcription failed.");
          return;
        }
        const transcript = (data.transcript ?? "").trim();
        if (!transcript) {
          setVoiceMessage("No speech was detected.");
          return;
        }
        setQuestion((current) => [current, transcript].filter(Boolean).join(current ? "\n\n" : ""));
        setVoiceMessage("Transcript added. Edit it, then send.");
        window.setTimeout(() => inputRef.current?.focus(), 50);
      } catch {
        setVoiceMessage("Transcription failed. Check your connection and try again.");
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

  return (
    <>
      {selectionState ? (
        <div
          className={
            isNarrowViewport
              ? "fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6.75rem)] z-[70] flex max-h-[35vh] flex-wrap items-center justify-center gap-1 overflow-auto rounded-[1.25rem] border border-stone-200 bg-stone-950 p-1 text-xs font-semibold text-white shadow-2xl sm:text-sm"
              : "fixed z-[60] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-full border border-stone-200 bg-stone-950 p-1 text-sm font-semibold text-white shadow-2xl"
          }
          style={isNarrowViewport ? undefined : { left: selectionState.x, top: selectionState.y }}
        >
          <button onClick={() => askAssistant("explain")} className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15">
            Explain
          </button>
          <button onClick={startChat} className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15">
            Chat
          </button>
          <button onClick={addSelectionNote} className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15">
            Add note
          </button>
          <a href={googleSearchUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full px-3 py-2 hover:bg-white/15">
            Search web
          </a>
        </div>
      ) : null}

      {panelOpen ? (
        <div className="fixed inset-0 z-[60] md:pointer-events-none">
          <button className="absolute inset-0 h-full w-full cursor-default bg-transparent md:hidden" aria-label="Minimize study assistant" onClick={() => setPanelOpen(false)} />
          <aside className="pointer-events-auto fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] max-h-[76vh] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl md:inset-x-auto md:right-6 md:bottom-6 md:w-[28rem]">
          <div className="border-b border-stone-200 bg-stone-50 p-4">
            <button type="button" className="mx-auto mb-3 block rounded-full px-8 py-2 md:hidden" aria-label="Minimize study assistant" onClick={() => setPanelOpen(false)}>
              <span className="block h-1.5 w-12 rounded-full bg-stone-300" />
            </button>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Study assistant</p>
                <h2 className="mt-1 line-clamp-1 break-words font-semibold text-stone-950">{sectionTitle || "Course context"}</h2>
              </div>
              <button onClick={() => setPanelOpen(false)} className="shrink-0 rounded-full border border-stone-200 px-3 py-1 text-sm font-semibold text-stone-700">
                Close
              </button>
            </div>
            <p className="mt-3 line-clamp-2 rounded-2xl bg-white px-3 py-2 text-sm text-stone-600 break-words">{selectedText || "Ask anything about the current page. The assistant uses the visible section and full chapter as context."}</p>
          </div>
          <div className="max-h-[42vh] space-y-3 overflow-auto p-4">
            {!messages.length ? <p className="text-sm leading-6 text-stone-600">Select text and ask for an explanation, or type a follow-up question here.</p> : null}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-800"}`}>
                <div className={`assistant-markdown ${message.role === "user" ? "assistant-markdown-dark" : ""}`}>
                  <AssistantMarkdown content={message.content} />
                </div>
              </div>
            ))}
            {pending ? <p className="text-sm text-stone-500">Thinking...</p> : null}
            {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {voiceMessage ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{voiceMessage}</p> : null}
          </div>
          <form
            className="flex flex-wrap gap-2 border-t border-stone-200 p-3 sm:flex-nowrap"
            onSubmit={(event) => {
              event.preventDefault();
              askAssistant("chat", question);
            }}
          >
            <textarea
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a follow-up..."
              rows={1}
              className="max-h-28 min-h-11 min-w-0 flex-[1_1_100%] resize-none rounded-2xl border border-stone-200 px-4 py-2 text-sm leading-6 outline-none ring-amber-500 focus:ring-2 sm:flex-1"
            />
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              className={`min-w-0 flex-1 rounded-full px-4 py-2 text-sm font-semibold sm:flex-none ${recording ? "bg-red-100 text-red-800" : "border border-stone-200 bg-white text-stone-800"}`}
            >
              {recording ? "Stop" : "Voice"}
            </button>
            <button disabled={pending || !question.trim()} className="min-w-0 flex-1 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none">
              Send
            </button>
          </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
