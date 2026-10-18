import { NextResponse } from "next/server";

import { requireCourseMember } from "@/lib/courses";
import { studyPackMarkdown } from "@/lib/study/markdown";
import { isStudyPack } from "@/lib/study/validate";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ courseId: string; fileId: string }> },
) {
  const { courseId, fileId } = await context.params;
  const access = await requireCourseMember(courseId);
  if (!access) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const [{ data: file }, { data: row }] = await Promise.all([
    access.supabase
      .from("source_files")
      .select("lesson_title, original_name")
      .eq("id", fileId)
      .eq("course_id", courseId)
      .maybeSingle(),
    access.supabase
      .from("lesson_study_packs")
      .select("pack")
      .eq("source_file_id", fileId)
      .eq("course_id", courseId)
      .maybeSingle(),
  ]);

  if (!file || !row || !isStudyPack(row.pack)) {
    return NextResponse.json({ error: "Study pack not found." }, { status: 404 });
  }

  const format = new URL(request.url).searchParams.get("format");
  const title = file.lesson_title || file.original_name;
  if (format === "md") {
    return new NextResponse(studyPackMarkdown(title, row.pack), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileId}.md"`,
      },
    });
  }

  return NextResponse.json(row.pack);
}
