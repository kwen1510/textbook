import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser, jsonError } from "@/lib/api";
import { getChapter, getSection } from "@/lib/course";
import { getGroq, GROQ_STUDY_MODEL } from "@/lib/groq";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const assistantSchema = z.object({
  mode: z.enum(["explain", "chat"]),
  selectedText: z.string().trim().max(2000).default(""),
  sectionId: z.string().min(1),
  question: z.string().trim().max(1000).optional(),
  history: z.array(chatMessageSchema).max(8).default([]),
});

function buildSystemPrompt(chapterTitle: string, sectionTitle: string, pageMarkdown: string) {
  return [
    "You are a concise course study tutor inside a private course app.",
    "Explain terms and concepts in practical interview-oriented language.",
    "Prefer short paragraphs and bullets. Avoid fluff.",
    "If the selection is ambiguous, state the likely meaning and ask a useful follow-up.",
    "Use the full current course page as primary context, with extra attention to the active section.",
    "You may add general background knowledge when it helps, but clearly prefer the course context.",
    `Current page: ${chapterTitle}`,
    `Current section: ${sectionTitle}`,
    `Full page context:\n${pageMarkdown.slice(0, 12000)}`,
  ].join("\n\n");
}

export async function POST(request: Request) {
  const { response } = await requireApiUser();
  if (response) return response;

  const parsed = assistantSchema.safeParse(await request.json());
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid assistant request");
  if (parsed.data.mode === "explain" && !parsed.data.selectedText) return jsonError("Select text to explain.");
  if (parsed.data.mode === "chat" && !parsed.data.question?.trim()) return jsonError("Ask a question first.");

  const section = getSection(parsed.data.sectionId);
  if (!section) return jsonError("Unknown section", 404);
  const chapter = getChapter(section.chapterSlug);
  if (!chapter) return jsonError("Unknown chapter", 404);
  const pageMarkdown = chapter.sections.map((chapterSection) => `## ${chapterSection.title}\n\n${chapterSection.markdown}`).join("\n\n");

  const userMessage =
    parsed.data.mode === "explain"
      ? `Explain this selected text clearly: "${parsed.data.selectedText}"`
      : [
          parsed.data.selectedText ? `Selected text: "${parsed.data.selectedText}"` : "No text is selected. Answer using the current page context.",
          `Question: ${parsed.data.question || "Explain this further."}`,
        ].join("\n");

  try {
    const completion = await getGroq().chat.completions.create({
      model: GROQ_STUDY_MODEL,
      temperature: 0.2,
      max_completion_tokens: 700,
      messages: [
        { role: "system", content: buildSystemPrompt(chapter.title, section.title, pageMarkdown) },
        ...parsed.data.history,
        { role: "user", content: userMessage },
      ],
    });

    return NextResponse.json({
      answer: completion.choices[0]?.message?.content ?? "I could not generate an explanation.",
      model: GROQ_STUDY_MODEL,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Study assistant failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
