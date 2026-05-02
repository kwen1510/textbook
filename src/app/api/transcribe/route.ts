import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireApiUser, jsonError, jsonRuntimeError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getSection } from "@/lib/course";
import { transcriptionJobs } from "@/lib/schema";
import { getGroq } from "@/lib/groq";

import { GROQ_TRANSCRIPTION_MODEL, validateAudioUpload } from "@/lib/transcription";

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const formData = await request.formData();
  const audio = formData.get("audio");
  const sectionId = formData.get("sectionId")?.toString();
  if (!(audio instanceof File)) return jsonError("Missing audio file");
  const audioError = validateAudioUpload(audio.size, audio.type);
  if (audioError) return jsonError(audioError, audio.size > 24 * 1024 * 1024 ? 413 : 400);
  if (sectionId && !getSection(sectionId)) return jsonError("Unknown section", 404);

  let db: ReturnType<typeof getDb>;
  let job: typeof transcriptionJobs.$inferSelect;
  try {
    db = getDb();
    [job] = await db.insert(transcriptionJobs).values({ userId: user.id, sectionId, status: "pending", model: GROQ_TRANSCRIPTION_MODEL }).returning();
  } catch (error) {
    return jsonRuntimeError(error, "Transcription job could not be created");
  }

  try {
    const transcription = await getGroq().audio.transcriptions.create({
      file: audio,
      model: GROQ_TRANSCRIPTION_MODEL,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
      language: "en",
      temperature: 0,
    });
    const transcript = transcription.text ?? "";
    await db.update(transcriptionJobs).set({ status: "completed", transcript, metadata: transcription, updatedAt: new Date() }).where(eq(transcriptionJobs.id, job.id));
    return NextResponse.json({ transcript, jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    await db.update(transcriptionJobs).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(transcriptionJobs.id, job.id));
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
