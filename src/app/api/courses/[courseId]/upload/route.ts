import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { requireCourseMember } from "@/lib/courses";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTimezone } from "@/lib/study/dates";
import { parsePlainTranscript } from "@/lib/transcript/plain";
import { parseVtt } from "@/lib/vtt/parse";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await context.params;
  const access = await requireCourseMember(courseId);
  if (!access) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const lessonTitle = String(form.get("lessonTitle") ?? "").trim();
  const lessonDate = String(form.get("lessonDate") ?? "").trim();
  const timezone = normalizeTimezone(String(form.get("timezone") ?? ""));
  const unitCode = String(form.get("unitCode") ?? "").trim();
  const subject = String(form.get("subject") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Add a .vtt or .txt file." }, { status: 400 });
  }

  const originalName = file.name.split(/[/\\]/).pop() ?? "";
  const extension = originalName.toLowerCase();
  if ((!extension.endsWith(".vtt") && !extension.endsWith(".txt")) || file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Use a .vtt or .txt file up to 5 MB." }, { status: 400 });
  }

  if (lessonDate && !/^\d{4}-\d{2}-\d{2}$/.test(lessonDate)) {
    return NextResponse.json({ error: "Use a lesson date in YYYY-MM-DD format." }, { status: 400 });
  }
  if (unitCode.length > 40 || subject.length > 120) {
    return NextResponse.json({ error: "Unit code or subject is too long." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const transcript = bytes.toString("utf8").replace(/^\uFEFF/, "");
  const cues = transcript.trimStart().startsWith("WEBVTT") ? parseVtt(transcript) : parsePlainTranscript(transcript);
  if (cues.length === 0) {
    return NextResponse.json({ error: "The file has no transcript text." }, { status: 400 });
  }

  const { data: allowed, error: limitError } = await access.supabase.rpc("consume_rate_limit", {
    target_action: "upload",
  });
  if (limitError || allowed !== true) {
    return NextResponse.json({ error: "Too many uploads. Try again in an hour." }, { status: 429 });
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: existing } = await access.supabase
    .from("source_files")
    .select("id")
    .eq("course_id", courseId)
    .eq("sha256", sha256)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "This transcript is already in the course.", fileId: existing.id }, { status: 409 });
  }

  const admin = createAdminClient();
  const fileId = crypto.randomUUID();
  const storagePath = `${courseId}/${fileId}.vtt`;

  const uploaded = await admin.storage.from("transcripts").upload(storagePath, bytes, {
    contentType: extension.endsWith(".txt") ? "text/plain" : "text/vtt",
    upsert: false,
  });
  if (uploaded.error) {
    return NextResponse.json({ error: "Could not store the file." }, { status: 500 });
  }

  const { error: insertError } = await admin.from("source_files").insert({
    id: fileId,
    course_id: courseId,
    uploaded_by: access.user.id,
    original_name: originalName,
    lesson_title: lessonTitle || originalName.replace(/\.(vtt|txt)$/i, ""),
    lesson_date: lessonDate || null,
    timezone,
    unit_code: unitCode || null,
    subject: subject || null,
    storage_path: storagePath,
    sha256,
    byte_size: bytes.byteLength,
  });

  if (insertError) {
    await admin.storage.from("transcripts").remove([storagePath]);
    return NextResponse.json({ error: "Could not record the course file." }, { status: 500 });
  }

  const { error: jobError } = await admin.from("processing_jobs").insert({
    course_id: courseId,
    source_file_id: fileId,
    status: "pending",
    stage: "parse",
  });

  if (jobError) {
    return NextResponse.json({ error: "The file was stored, but the processing job was not created." }, { status: 500 });
  }

  return NextResponse.json({ fileId }, { status: 201 });
}
