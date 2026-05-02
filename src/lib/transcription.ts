export const GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

const supportedAudioTypes = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/ogg",
]);

export function isSupportedAudioType(type: string) {
  return supportedAudioTypes.has(type) || type.startsWith("audio/");
}

export function validateAudioUpload(size: number, type: string) {
  if (size > MAX_AUDIO_BYTES) return "Recording is too large. Keep voice notes under 24 MB.";
  if (!isSupportedAudioType(type)) return "Unsupported audio file type.";
  return null;
}
