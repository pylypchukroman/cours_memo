import { NextResponse } from "next/server";

import { requireCourseMember } from "@/lib/courses";
import { isStudyPack } from "@/lib/study/validate";

export const runtime = "nodejs";

function icsDate(date: string): string {
  return date.replaceAll("-", "");
}

function escapeText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await context.params;
  const access = await requireCourseMember(courseId);
  if (!access) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const [{ data: packs }, { data: states }, { data: files }] = await Promise.all([
    access.supabase.from("lesson_study_packs").select("source_file_id, pack").eq("course_id", courseId),
    access.supabase.from("study_item_states").select("source_file_id, item_key, review_status, completion_status").eq("course_id", courseId),
    access.supabase.from("source_files").select("id, lesson_title, original_name").eq("course_id", courseId),
  ]);

  const titles = new Map((files ?? []).map((file) => [file.id, file.lesson_title || file.original_name]));
  const confirmed = new Set(
    (states ?? [])
      .filter((state) => state.review_status === "confirmed" && state.completion_status !== "done")
      .map((state) => `${state.source_file_id}:${state.item_key}`),
  );

  const events: string[] = [];
  for (const row of packs ?? []) {
    if (!isStudyPack(row.pack)) {
      continue;
    }
    for (const task of row.pack.tasks) {
      if (!task.due.date || !confirmed.has(`${row.source_file_id}:${task.item_key}`)) {
        continue;
      }
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:${task.item_key}@${row.source_file_id}`,
          `DTSTART;VALUE=DATE:${icsDate(task.due.date)}`,
          `SUMMARY:${escapeText(task.title)}`,
          `DESCRIPTION:${escapeText(titles.get(row.source_file_id) ?? "Lesson")}`,
          "END:VEVENT",
        ].join("\r\n"),
      );
    }
  }

  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Course Memo//EN", ...events, "END:VCALENDAR"].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${courseId}.ics"`,
    },
  });
}
