import { parsePlainTranscript } from "@/lib/transcript/plain";
import { parseVtt, type Cue } from "@/lib/vtt/parse";

export function parseTranscript(input: string): Cue[] {
  const text = input.replace(/^\uFEFF/, "");
  return text.trimStart().startsWith("WEBVTT")
    ? parseVtt(text)
    : parsePlainTranscript(text);
}
