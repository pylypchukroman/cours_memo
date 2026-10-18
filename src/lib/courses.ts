import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/time";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return { supabase, user };
}

export async function requireCourseMember(courseId: string) {
  if (!isUuid(courseId)) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("course_members")
    .select("role")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  return { supabase, user, role: membership.role as string };
}
