"use server";

import { revalidatePath } from "next/cache";

import { requireCourseMember } from "@/lib/courses";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/time";

const COMPLETIONS = new Set(["todo", "done", "unknown"]);
const REVIEWS = new Set(["pending", "confirmed", "corrected", "dismissed"]);

export async function setStudyState(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const sourceFileId = String(formData.get("sourceFileId") ?? "");
  const itemKey = String(formData.get("itemKey") ?? "");
  const completionStatus = String(formData.get("completionStatus") ?? "todo");
  const reviewStatus = String(formData.get("reviewStatus") ?? "pending");
  const note = String(formData.get("note") ?? "").trim();

  if (!isUuid(courseId) || !isUuid(sourceFileId) || !/^[a-f0-9]{16}$/.test(itemKey)) {
    return;
  }
  if (!COMPLETIONS.has(completionStatus) || !REVIEWS.has(reviewStatus) || note.length > 2000) {
    return;
  }

  const access = await requireCourseMember(courseId);
  if (!access) {
    return;
  }

  const { data: file } = await access.supabase
    .from("source_files")
    .select("id")
    .eq("id", sourceFileId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!file) {
    return;
  }

  const { error } = await access.supabase.from("study_item_states").upsert(
    {
      course_id: courseId,
      source_file_id: sourceFileId,
      item_key: itemKey,
      completion_status: completionStatus,
      review_status: reviewStatus,
      note: note || null,
    },
    { onConflict: "source_file_id,item_key" },
  );
  if (error) {
    return;
  }

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
}

export async function deleteLesson(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const sourceFileId = String(formData.get("sourceFileId") ?? "");
  if (!isUuid(courseId) || !isUuid(sourceFileId)) {
    return;
  }

  const access = await requireCourseMember(courseId);
  if (!access) {
    return;
  }

  const admin = createAdminClient();
  const { data: file } = await admin
    .from("source_files")
    .select("storage_path")
    .eq("id", sourceFileId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!file) {
    return;
  }

  await admin.from("course_memory_items").delete().eq("source_file_id", sourceFileId).eq("course_id", courseId);
  await admin.storage.from("transcripts").remove([file.storage_path]);
  await admin.from("source_files").delete().eq("id", sourceFileId).eq("course_id", courseId);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
}

export async function rebuildStudyPack(formData: FormData) {
  const courseId = String(formData.get("courseId") ?? "");
  const sourceFileId = String(formData.get("sourceFileId") ?? "");
  if (!isUuid(courseId) || !isUuid(sourceFileId)) {
    return;
  }

  const access = await requireCourseMember(courseId);
  if (!access) {
    return;
  }

  const admin = createAdminClient();
  const { data: file } = await admin
    .from("source_files")
    .select("id")
    .eq("id", sourceFileId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!file) {
    return;
  }

  await admin.from("lesson_study_packs").delete().eq("source_file_id", sourceFileId);
  const { data: job } = await admin
    .from("processing_jobs")
    .select("id")
    .eq("source_file_id", sourceFileId)
    .maybeSingle();

  if (job) {
    await admin
      .from("processing_jobs")
      .update({ status: "pending", stage: "segment", attempts: 0, error: null, locked_at: null })
      .eq("id", job.id);
  } else {
    await admin.from("processing_jobs").insert({
      course_id: courseId,
      source_file_id: sourceFileId,
      status: "pending",
      stage: "segment",
    });
  }

  revalidatePath(`/courses/${courseId}`);
}
