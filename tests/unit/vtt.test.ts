import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseTranscript } from "@/lib/transcript/parse";
import { chunkCues, estimateTokens } from "@/lib/vtt/chunk";
import { parseTimestamp, parseVtt } from "@/lib/vtt/parse";

describe("parseVtt", () => {
  it("reads speakers, times, and cue text", () => {
    const input = readFileSync(path.join(process.cwd(), "tests/fixtures/sample.vtt"), "utf8");
    const cues = parseVtt(input);

    expect(cues).toHaveLength(3);
    expect(cues[0]).toMatchObject({
      speaker: "Викладач",
      text: "Похідна показує швидкість зміни.",
      startMs: 1000,
      endMs: 4000,
    });
    expect(cues[2].startMs).toBe(70_000);
    expect(cues[2].endMs).toBe(72_250);
  });

  it("parses minute timestamps and ignores notes", () => {
    expect(parseTimestamp("01:02.5")).toBe(62_500);
    const cues = parseVtt("WEBVTT\n\nNOTE skip me\n\n00:00.000 --> 00:01.000\nHello &amp; welcome");
    expect(cues).toEqual([
      { speaker: null, text: "Hello & welcome", startMs: 0, endMs: 1000 },
    ]);
  });

  it("detects VTT after a byte-order mark", () => {
    const cues = parseTranscript("\uFEFFWEBVTT\n\n00:00.000 --> 00:01.000\nHello");
    expect(cues).toEqual([
      { speaker: null, text: "Hello", startMs: 0, endMs: 1000 },
    ]);
  });
});

describe("chunkCues", () => {
  it("keeps a short lesson in one chunk", () => {
    const cues = parseVtt(readFileSync(path.join(process.cwd(), "tests/fixtures/sample.vtt"), "utf8"));
    const chunks = chunkCues(cues);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].startMs).toBe(1000);
    expect(chunks[0].endMs).toBe(72_250);
    expect(chunks[0].text).toContain("Викладач: Похідна");
    expect(chunks[0].tokenCount).toBe(estimateTokens(chunks[0].text));
  });

  it("splits long cues and overlaps the next chunk", () => {
    const cues = [
      { speaker: null, text: "a".repeat(2000), startMs: 0, endMs: 1000 },
      { speaker: null, text: "b".repeat(2000), startMs: 1000, endMs: 2000 },
      { speaker: null, text: "c".repeat(2000), startMs: 2000, endMs: 3000 },
    ];
    const chunks = chunkCues(cues, { targetTokens: 200, maxTokens: 300, overlapTokens: 50 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].tokenCount).toBeLessThanOrEqual(300);
    expect(chunks[1].text.length).toBeGreaterThan(0);
  });
});
