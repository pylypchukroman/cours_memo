import { NextResponse } from "next/server";

import { answerFromChunks, classifyQuestion } from "@/lib/chat/answer";
import type { CourseAnswer } from "@/lib/chat/answer";
import type { RetrievedChunk } from "@/lib/chat/citations";
import { requireCourseMember } from "@/lib/courses";
import { logModelUse } from "@/lib/log";
import { embedTexts } from "@/lib/openai/client";
import { getOpenAIEnv, hasOpenAIEnv } from "@/lib/openai/env";

export const runtime = "nodejs";

function streamAnswer(result: CourseAnswer) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const parts = result.answer.split(/(\s+)/);
      for (const part of parts) {
        if (part) {
          send({ type: "delta", text: part });
        }
      }
      send({ type: "citations", citations: result.citations });
      send({ type: "done", status: result.status });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await context.params;
  const access = await requireCourseMember(courseId);
  if (!access) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  if (!hasOpenAIEnv()) {
    return NextResponse.json({ error: "The OpenAI API key is not configured." }, { status: 503 });
  }

  const { data: allowed, error: limitError } = await access.supabase.rpc("consume_rate_limit", {
    target_action: "chat",
  });
  if (limitError || allowed !== true) {
    return NextResponse.json({ error: "Too many questions. Try again in an hour." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return NextResponse.json({ error: "A question can be at most 2000 characters." }, { status: 400 });
  }

  const plan = await classifyQuestion({
    question: message,
    userId: access.user.id,
    courseId,
  });

  let chunks: RetrievedChunk[] = [];

  if (plan.mode === "memory") {
    const { data: items } = await access.supabase
      .from("course_memory_items")
      .select("chunk_id, item_type, status")
      .eq("course_id", courseId)
      .in("item_type", plan.itemTypes)
      .in("status", plan.statuses);

    const chunkIds = [...new Set((items ?? []).map((item) => item.chunk_id).filter(Boolean))] as string[];
    if (chunkIds.length > 0) {
      const { data } = await access.supabase
        .from("chunks")
        .select("id, source_file_id, text, start_ms, end_ms, source_files(original_name, lesson_title)")
        .in("id", chunkIds)
        .eq("course_id", courseId);
      chunks = mapChunks(data ?? []);
    }
  }

  if (chunks.length === 0) {
    const embedded = await embedTexts([message]);
    logModelUse({
      route: "chat.embed",
      model: getOpenAIEnv().embeddingModel,
      inputTokens: embedded.usage.inputTokens,
      outputTokens: embedded.usage.outputTokens,
      userId: access.user.id,
      courseId,
    });
    const { data, error } = await access.supabase.rpc("match_course_chunks", {
      target_course_id: courseId,
      query_embedding: JSON.stringify(embedded.vectors[0]),
      match_count: 8,
    });
    if (error) {
      return NextResponse.json({ error: "Could not search the course chunks." }, { status: 500 });
    }
    chunks = (data ?? []).map((row: {
      id: string;
      source_file_id: string;
      text: string;
      start_ms: number;
      end_ms: number;
      original_name: string;
      lesson_title: string | null;
    }) => ({
      id: row.id,
      sourceFileId: row.source_file_id,
      text: row.text,
      startMs: row.start_ms,
      endMs: row.end_ms,
      originalName: row.original_name,
      lessonTitle: row.lesson_title,
    }));
  }

  try {
    const answer = await answerFromChunks({
      question: message,
      chunks,
      userId: access.user.id,
      courseId,
    });
    return streamAnswer(answer);
  } catch {
    return NextResponse.json({ error: "Could not produce an answer." }, { status: 502 });
  }
}

function mapChunks(
  rows: Array<{
    id: string;
    source_file_id: string;
    text: string;
    start_ms: number;
    end_ms: number;
    source_files: { original_name: string; lesson_title: string | null } | { original_name: string; lesson_title: string | null }[] | null;
  }>,
): RetrievedChunk[] {
  return rows.map((row) => {
    const source = Array.isArray(row.source_files) ? row.source_files[0] : row.source_files;
    return {
      id: row.id,
      sourceFileId: row.source_file_id,
      text: row.text,
      startMs: row.start_ms,
      endMs: row.end_ms,
      originalName: source?.original_name ?? "transcript.vtt",
      lessonTitle: source?.lesson_title ?? null,
    };
  });
}
