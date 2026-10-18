import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { classifyByKeywords } from "@/lib/chat/classify";

type EvalCase = {
  id: string;
  question: string;
  expectedMode: "retrieval" | "memory";
  expectedTypes?: string[];
};

describe("classifyByKeywords", () => {
  const cases = JSON.parse(
    readFileSync(path.join(process.cwd(), "eval/queries.json"), "utf8"),
  ) as EvalCase[];

  it.each(cases)("$id routes $question", (evalCase) => {
    const plan = classifyByKeywords(evalCase.question);
    expect(plan.mode).toBe(evalCase.expectedMode);
    if (evalCase.expectedMode === "memory" && plan.mode === "memory") {
      expect(plan.itemTypes).toEqual(expect.arrayContaining(evalCase.expectedTypes ?? []));
      expect(plan.statuses).toEqual(["active"]);
    }
  });
});
