import type { Cue } from "@/lib/vtt/parse";

function normalize(input: string): string {
  return input.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

export function parsePlainTranscript(input: string): Cue[] {
  const blocks = normalize(input).split(/\n{2,}/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      continue;
    }

    let speaker: string | null = null;
    let textLines = lines;
    const speakerMatch = lines[0].match(/^([^:]{1,40}):\s+(.+)$/);
    if (speakerMatch && !/^\d/.test(speakerMatch[1])) {
      speaker = speakerMatch[1].trim();
      textLines = [speakerMatch[2], ...lines.slice(1)];
    }

    const text = textLines.join(" ").replace(/\s+/g, " ").trim();
    if (!text) {
      continue;
    }

    cues.push({ speaker, text, startMs: null, endMs: null });
  }

  return cues;
}
