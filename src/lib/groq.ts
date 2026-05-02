import Groq from "groq-sdk";

let groqClient: Groq | null = null;

export const GROQ_STUDY_MODEL = process.env.GROQ_STUDY_MODEL ?? "llama-3.1-8b-instant";

export function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");
  if (!groqClient) groqClient = new Groq({ apiKey });
  return groqClient;
}
