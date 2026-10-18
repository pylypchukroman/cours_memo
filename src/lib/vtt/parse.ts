export type Cue = {
  speaker: string | null;
  text: string;
  startMs: number;
  endMs: number;
};

const TIMECODE =
  /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.](\d{1,3})$/;

function decodeEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ");
}

export function parseTimestamp(value: string): number | null {
  const match = TIMECODE.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = match[4].padEnd(3, "0").slice(0, 3);
  const millis = Number(fraction);

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

function cueText(lines: string[]): { speaker: string | null; text: string } {
  const speakers = new Set<string>();
  const text = lines
    .map((line) => {
      const speakerMatch = line.match(/<v(?:\.[^ >]+)?\s+([^>]+)>/i);
      if (speakerMatch?.[1]) {
        speakers.add(decodeEntities(speakerMatch[1].trim()));
      }

      return decodeEntities(line.replace(/<[^>]+>/g, "")).trim();
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const speaker = speakers.size > 0 ? [...speakers].join(", ") : null;
  return { speaker, text };
}

export function parseVtt(input: string): Cue[] {
  const normalized = input.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const blocks = normalized.split(/\n{2,}/);
  const cues: Cue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) {
      continue;
    }

    const header = lines[0].toUpperCase();
    if (header.startsWith("WEBVTT") || header.startsWith("NOTE") || header.startsWith("STYLE") || header.startsWith("REGION")) {
      continue;
    }

    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) {
      continue;
    }

    const [rawStart, rawEnd] = lines[timingIndex].split("-->").map((part) => part.trim().split(/\s+/)[0] ?? "");
    const startMs = parseTimestamp(rawStart);
    const endMs = parseTimestamp(rawEnd);
    if (startMs === null || endMs === null || endMs < startMs) {
      continue;
    }

    const { speaker, text } = cueText(lines.slice(timingIndex + 1));
    if (!text) {
      continue;
    }

    cues.push({ speaker, text, startMs, endMs });
  }

  return cues;
}
