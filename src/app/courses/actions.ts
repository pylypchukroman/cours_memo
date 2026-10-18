"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/courses";

export type CourseFormState = { error?: string } | null;

export async function createCourse(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title || title.length > 200) {
    return { error: "The course title must be 1 to 200 characters." };
  }

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title,
      description: description || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Could not create the course." };
  }

  redirect(`/courses/${data.id}`);
}
