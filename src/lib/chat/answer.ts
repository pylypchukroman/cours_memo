import { classifyByKeywords, parseQueryPlan, type QueryPlan } from "@/lib/chat/classify";
import {
  INSUFFICIENT_EVIDENCE_MESSAGE,
  validateCitations,
  type ProposedCitation,
  type RetrievedChunk,
  type ValidCitation,
} from "@/lib/chat/citations";
import { buildCoursePrompt } from "@/lib/chat/prompt";
import { logModelUse } from "@/lib/log";
import { createStructuredResponse } from "@/lib/openai/client";
import { getOpenAIEnv, hasOpenAIEnv } from "@/lib/openai/env";

const ANSWER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["answered", "insufficient_evidence"] },
    answer: { type: "string" },
    citations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chunk_id: { type: "string" },
          excerpt: { type: "string" },
        },
        required: ["chunk_id", "excerpt"],
      },
    },
  },
  required: ["status", "answer", "citations"],
} as const;

const QUERY_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: { type: "string", enum: ["retrieval", "memory"] },
    item_types: {
      type: "array",
      items: {
        type: "string",
        enum: ["concept", "task", "assessment", "promise", "correction"],
      },
    },
    statuses: {
      type: "array",
      items: { type: "string", enum: ["active", "superseded", "cancelled"] },
    },
  },
  required: ["mode", "item_types", "statuses"],
} as const;

export type CourseAnswer = {
  status: "answered" | "insufficient_evidence";
  answer: string;
  citations: ValidCitation[];
};

export async function classifyQuestion(options: {
  question: string;
  userId: string;
  courseId: string;
}): Promise<QueryPlan> {
  const fallback = classifyByKeywords(options.question);
  if (!hasOpenAIEnv()) {
    return fallback;
  }

  try {
    const { classifierModel } = getOpenAIEnv();
    const result = await createStructuredResponse<{
      mode: "retrieval" | "memory";
      item_types: string[];
      statuses: string[];
    }>({
      model: classifierModel,
      schemaName: "query_plan",
      schema: QUERY_PLAN_SCHEMA,
      instructions:
        "Classify the student's question. Use memory when they want tasks, concepts, assessments, promises, or corrections from course memory. Use retrieval when they want a specific place in the transcript. Statuses default to active only.",
      input: options.question,
      maxOutputTokens: 300,
    });
    logModelUse({
      route: "chat.classify",
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      userId: options.userId,
      courseId: options.courseId,
    });
    return parseQueryPlan(result.data) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function answerFromChunks(options: {
  question: string;
  chunks: RetrievedChunk[];
  userId: string;
  courseId: string;
}): Promise<CourseAnswer> {
  if (options.chunks.length === 0) {
    return {
      status: "insufficient_evidence",
      answer: INSUFFICIENT_EVIDENCE_MESSAGE,
      citations: [],
    };
  }

  const { chatModel } = getOpenAIEnv();
  const prompt = buildCoursePrompt(options.question, options.chunks);
  const result = await createStructuredResponse<{
    status: "answered" | "insufficient_evidence";
    answer: string;
    citations: Array<{ chunk_id: string; excerpt: string }>;
  }>({
    model: chatModel,
    schemaName: "course_answer",
    schema: ANSWER_SCHEMA,
    instructions: prompt.instructions,
    input: prompt.input,
  });

  logModelUse({
    route: "chat.answer",
    model: result.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    userId: options.userId,
    courseId: options.courseId,
  });

  const proposed: ProposedCitation[] = result.data.citations.map((citation) => ({
    chunkId: citation.chunk_id,
    excerpt: citation.excerpt,
  }));
  const citations = validateCitations(proposed, options.chunks);

  if (result.data.status !== "answered" || citations.length === 0) {
    return {
      status: "insufficient_evidence",
      answer: INSUFFICIENT_EVIDENCE_MESSAGE,
      citations: [],
    };
  }

  return {
    status: "answered",
    answer: result.data.answer.trim() || INSUFFICIENT_EVIDENCE_MESSAGE,
    citations,
  };
}
