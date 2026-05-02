import { describe, expect, it } from "vitest";
import { MAX_AUDIO_BYTES, validateAudioUpload } from "../src/lib/transcription";

describe("audio upload validation", () => {
  it("accepts mobile browser audio recordings under the size limit", () => {
    expect(validateAudioUpload(1024, "audio/webm")).toBeNull();
  });

  it("rejects oversized audio before calling Groq", () => {
    expect(validateAudioUpload(MAX_AUDIO_BYTES + 1, "audio/webm")).toMatch(/too large/i);
  });

  it("rejects non-audio uploads", () => {
    expect(validateAudioUpload(1024, "text/plain")).toMatch(/unsupported/i);
  });
});
