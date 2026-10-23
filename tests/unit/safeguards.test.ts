import { afterEach, describe, expect, it, vi } from "vitest";

import { logModelUse } from "@/lib/log";
import { getOpenAIEnv, hasOpenAIEnv } from "@/lib/openai/env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("openai env", () => {
  it("rejects the placeholder key", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-your-openai-key");
    expect(hasOpenAIEnv()).toBe(false);
    expect(() => getOpenAIEnv()).toThrow(/OPENAI_API_KEY/);
  });
});

describe("logModelUse", () => {
  it("records token usage without transcript text", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const transcript = "секретний текст транскрипту";

    logModelUse({
      route: "pipeline.study",
      model: "gpt-5.4-nano",
      inputTokens: 12,
      outputTokens: 4,
      userId: "user-1",
      courseId: "course-1",
    });

    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain(transcript);
    expect(JSON.parse(line)).toMatchObject({
      route: "pipeline.study",
      inputTokens: 12,
      outputTokens: 4,
    });
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(
      ["at", "courseId", "inputTokens", "model", "outputTokens", "route", "userId"].sort(),
    );
  });
});
