import Link from "next/link";

import { CreateCourseForm } from "@/components/create-course-form";
import { requireUser } from "@/lib/courses";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CoursesPage() {
  const { supabase } = await requireUser();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, description, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>New course</CardTitle>
          <CardDescription>You will be the only owner</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateCourseForm />
        </CardContent>
      </Card>
      <section className="grid gap-4">
        <h1 className="text-2xl font-semibold">My courses</h1>
        {(courses ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No courses yet. Create the first one on the left.</p>
        ) : (
          <ul className="grid gap-3">
            {(courses ?? []).map((course) => (
              <li key={course.id}>
                <Link href={`/courses/${course.id}`} className="block">
                  <Card>
                    <CardHeader>
                      <CardTitle>{course.title}</CardTitle>
                      {course.description ? <CardDescription>{course.description}</CardDescription> : null}
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
