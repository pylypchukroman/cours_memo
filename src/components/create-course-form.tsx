"use client";

import { useActionState } from "react";

import { createCourse, type CourseFormState } from "@/app/courses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateCourseForm() {
  const [state, action, pending] = useActionState<CourseFormState, FormData>(createCourse, null);

  return (
    <form action={action} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Title
        <Input name="title" required maxLength={200} />
      </label>
      <label className="grid gap-1 text-sm">
        Description
        <textarea
          name="description"
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        Create course
      </Button>
    </form>
  );
}
