import type { Cue } from "@/lib/vtt/parse";

type ChunkDraft = {
  text: string;
  startMs: number | null;
  endMs: number | null;
  tokenCount: number;
};

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

type ChunkOptions = {
  targetTokens?: number;
  maxTokens?: number;
  overlapTokens?: number;
};

function splitLongText(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) {
    return [text];
  }

  const parts: string[] = [];
  let rest = text;
  while (rest.length > maxChars) {
    const slice = rest.slice(0, maxChars);
    const breakAt = Math.max(slice.lastIndexOf(" "), maxChars - 40);
    const cut = breakAt > 0 ? breakAt : maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) {
    parts.push(rest);
  }
  return parts;
}

export function chunkCues(cues: Cue[], options: ChunkOptions = {}): ChunkDraft[] {
  const targetTokens = options.targetTokens ?? 650;
  const maxTokens = options.maxTokens ?? 800;
  const overlapTokens = options.overlapTokens ?? 120;
  const pieces: Cue[] = [];

  for (const cue of cues) {
    const parts = splitLongText(cue.text, maxTokens);
    parts.forEach((text, index) => {
      pieces.push({
        speaker: cue.speaker,
        text,
        startMs: cue.startMs,
        endMs: index === parts.length - 1 ? cue.endMs : cue.startMs,
      });
    });
  }

  const chunks: ChunkDraft[] = [];
  let current: Cue[] = [];

  const flush = () => {
    if (current.length === 0) {
      return;
    }

    const text = current
      .map((cue) => (cue.speaker ? `${cue.speaker}: ${cue.text}` : cue.text))
      .join("\n");
    chunks.push({
      text,
      startMs: current[0].startMs,
      endMs: current[current.length - 1].endMs,
      tokenCount: estimateTokens(text),
    });

    const overlap: Cue[] = [];
    let tokens = 0;
    for (let index = current.length - 1; index >= 0; index -= 1) {
      const cueTokens = estimateTokens(current[index].text);
      if (overlap.length > 0 && tokens + cueTokens > overlapTokens) {
        break;
      }
      overlap.unshift(current[index]);
      tokens += cueTokens;
    }
    current = overlap.length === current.length ? [] : overlap;
  };

  for (const piece of pieces) {
    const nextTokens = estimateTokens(
      [...current, piece].map((cue) => cue.text).join("\n"),
    );
    if (current.length > 0 && nextTokens > targetTokens) {
      flush();
    }
    current.push(piece);
    if (estimateTokens(current.map((cue) => cue.text).join("\n")) >= maxTokens) {
      flush();
    }
  }

  flush();
  return chunks;
}
