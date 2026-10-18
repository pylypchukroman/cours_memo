import { NextResponse } from "next/server";

import { requireCourseMember } from "@/lib/courses";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string; fileId: string }> },
) {
  const { courseId, fileId } = await context.params;
  const access = await requireCourseMember(courseId);
  if (!access) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  const { data: file } = await access.supabase
    .from("source_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const signed = await admin.storage.from("transcripts").createSignedUrl(file.storage_path, 60);
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: "Could not open the file." }, { status: 500 });
  }

  return NextResponse.redirect(signed.data.signedUrl);
}
