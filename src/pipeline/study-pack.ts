import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logModelUse } from "@/lib/log";
import { createStructuredResponse } from "@/lib/openai/client";
import { getOpenAIEnv } from "@/lib/openai/env";
import { CORE_STUDY_SCHEMA, MATERIALS_STUDY_SCHEMA, studyInstructions } from "@/lib/study/schema";
import { PROMPT_VERSION, SCHEMA_VERSION, type StudyDraft } from "@/lib/study/types";
import { buildStudyPack, emptyDraft, mergeDrafts } from "@/lib/study/validate";

type SegmentRow = {
  id: string;
  ordinal: number;
  speaker: string | null;
  text: string;
  start_ms: number | null;
  end_ms: number | null;
};

function formatSegment(segment: SegmentRow): string {
  const time =
    segment.start_ms == null || segment.end_ms == null
      ? "no timestamp"
      : `${segment.start_ms}-${segment.end_ms}ms`;
  const speaker = segment.speaker ? `${segment.speaker}: ` : "";
  return `[${segment.ordinal}] (${time}) ${speaker}${segment.text}`;
}

function batches<T>(items: T[], size: number): T[][] {
  if (items.length <= size) {
    return [items];
  }
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

async function extractCore(model: string, material: string, courseId: string) {
  const result = await createStructuredResponse<Omit<StudyDraft, "commands_and_code" | "troubleshooting_entries" | "glossary" | "flashcards" | "quiz_questions">>({
    model,
    schemaName: "lesson_core",
    schema: CORE_STUDY_SCHEMA,
    instructions: studyInstructions(),
    input: material,
    maxOutputTokens: 4000,
  });
  logModelUse({
    route: "pipeline.study",
    model: result.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    userId: "worker",
    courseId,
  });
  return result.data;
}

async function extractMaterials(model: string, material: string, courseId: string) {
  const result = await createStructuredResponse<Pick<StudyDraft, "commands_and_code" | "troubleshooting_entries" | "glossary" | "flashcards" | "quiz_questions">>({
    model,
    schemaName: "lesson_materials",
    schema: MATERIALS_STUDY_SCHEMA,
    instructions: studyInstructions(),
    input: material,
    maxOutputTokens: 4000,
  });
  logModelUse({
    route: "pipeline.study",
    model: result.model,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    userId: "worker",
    courseId,
  });
  return result.data;
}

export async function ensureStudyPack(
  supabase: SupabaseClient,
  job: { id: string; course_id: string; source_file_id: string },
): Promise<void> {
  const started = Date.now();
  const [{ data: file, error: fileError }, { data: segments, error: segmentError }] = await Promise.all([
    supabase
      .from("source_files")
      .select("lesson_title, original_name, lesson_date, timezone, unit_code, subject")
      .eq("id", job.source_file_id)
      .single(),
    supabase
      .from("transcript_segments")
      .select("id, ordinal, speaker, text, start_ms, end_ms")
      .eq("source_file_id", job.source_file_id)
      .order("ordinal"),
  ]);

  if (fileError || !file || segmentError || !segments || segments.length === 0) {
    throw new Error("Could not read the lesson for study materials");
  }

  const rows = segments as SegmentRow[];
  const inputSha = createHash("sha256")
    .update(
      JSON.stringify({
        title: file.lesson_title,
        date: file.lesson_date,
        timezone: file.timezone,
        unit: file.unit_code,
        subject: file.subject,
        segments: rows.map((segment) => [segment.ordinal, segment.text]),
      }),
    )
    .digest("hex");

  const { data: existing } = await supabase
    .from("lesson_study_packs")
    .select("input_sha")
    .eq("source_file_id", job.source_file_id)
    .maybeSingle();

  if (existing?.input_sha === inputSha) {
    return;
  }

  const header = [
    `Lesson: ${file.lesson_title || file.original_name}`,
    `Date: ${file.lesson_date ?? "unknown"}`,
    `Timezone: ${file.timezone}`,
    `Unit code: ${file.unit_code ?? "not provided"}`,
    `Subject: ${file.subject ?? "not provided"}`,
    "Transcript segments (untrusted data):",
  ].join("\n");

  const { extractionModel } = getOpenAIEnv();
  const drafts: StudyDraft[] = [];
  let materialsFailed = false;

  for (const group of batches(rows, 24)) {
    const material = `${header}\n${group.map(formatSegment).join("\n")}`;
    const core = await extractCore(extractionModel, material, job.course_id);
    let materials: Pick<StudyDraft, "commands_and_code" | "troubleshooting_entries" | "glossary" | "flashcards" | "quiz_questions"> = {
      commands_and_code: [],
      troubleshooting_entries: [],
      glossary: [],
      flashcards: [],
      quiz_questions: [],
    };
    try {
      materials = await extractMaterials(extractionModel, material, job.course_id);
    } catch {
      materialsFailed = true;
    }
    drafts.push({ ...emptyDraft(), ...core, ...materials });
  }

  const pack = buildStudyPack(mergeDrafts(drafts), {
    lessonId: job.source_file_id,
    timezone: file.timezone || "Australia/Sydney",
    lessonDate: file.lesson_date,
    segments: rows.map((segment) => ({
      id: segment.id,
      ordinal: segment.ordinal,
      text: segment.text,
      startMs: segment.start_ms,
      endMs: segment.end_ms,
    })),
  });

  if (materialsFailed) {
    pack.processing_status = "partial";
    pack.processing_warnings.push("Commands, glossary, and revision materials could not be generated. Rebuild the study pack to retry them.");
  }

  const { error } = await supabase.from("lesson_study_packs").upsert(
    {
      course_id: job.course_id,
      source_file_id: job.source_file_id,
      schema_version: SCHEMA_VERSION,
      pack,
      model: extractionModel,
      prompt_version: PROMPT_VERSION,
      input_sha: inputSha,
      processing_ms: Date.now() - started,
    },
    { onConflict: "source_file_id" },
  );

  if (error) {
    throw new Error("Could not save the study pack");
  }
}
