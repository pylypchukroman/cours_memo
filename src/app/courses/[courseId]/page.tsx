import Link from "next/link";
import { notFound } from "next/navigation";

import { ChatPanel } from "@/components/chat-panel";
import { JobPoller } from "@/components/job-poller";
import { UploadForm } from "@/components/upload-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCourseMember } from "@/lib/courses";
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS, VERSION_ACTION_LABELS } from "@/lib/memory/labels";
import type { ItemStatus, ItemType } from "@/lib/memory/types";
import { formatTimestamp } from "@/lib/time";

export const dynamic = "force-dynamic";

const JOB_LABELS: Record<string, string> = {
  pending: "Queued",
  running: "Processing",
  done: "Ready",
  failed: "Failed",
};

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const access = await requireCourseMember(courseId);
  if (!access) {
    notFound();
  }

  const { supabase } = access;
  const [{ data: course }, { data: files }, { data: jobs }, { data: items }, { data: versions }] =
    await Promise.all([
      supabase.from("courses").select("title, description").eq("id", courseId).single(),
      supabase
        .from("source_files")
        .select("id, original_name, lesson_title, byte_size, created_at")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
      supabase
        .from("processing_jobs")
        .select("source_file_id, status, stage, error")
        .eq("course_id", courseId),
      supabase
        .from("course_memory_items")
        .select("id, item_type, status, title, summary, start_ms, end_ms, excerpt")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false }),
      supabase
        .from("course_memory_versions")
        .select("id, action, snapshot, created_at")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  if (!course) {
    notFound();
  }

  const jobsByFile = new Map((jobs ?? []).map((job) => [job.source_file_id, job]));
  const activeJob = (jobs ?? []).some((job) => job.status === "pending" || job.status === "running");
  const activeItems = (items ?? []).filter((item) => item.status === "active");

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-10">
      <JobPoller active={activeJob} />
      <div className="grid gap-2">
        <Link href="/courses" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          All courses
        </Link>
        <h1 className="text-3xl font-semibold">{course.title}</h1>
        {course.description ? <p className="text-muted-foreground">{course.description}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>.vtt only, up to 5 MB</CardDescription>
          </CardHeader>
          <CardContent>
            <UploadForm courseId={courseId} />
          </CardContent>
        </Card>
        <section className="grid gap-3">
          <h2 className="text-lg font-medium">Lessons</h2>
          {(files ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Upload the first transcript.</p>
          ) : (
            <ul className="grid gap-3">
              {(files ?? []).map((file) => {
                const job = jobsByFile.get(file.id);
                return (
                  <li key={file.id} className="rounded-xl border border-border px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{file.lesson_title || file.original_name}</p>
                        <p className="text-sm text-muted-foreground">{file.original_name}</p>
                      </div>
                      <Badge variant={job?.status === "failed" ? "destructive" : "secondary"}>
                        {JOB_LABELS[job?.status ?? "pending"] ?? job?.status}
                      </Badge>
                    </div>
                    {job?.error ? <p className="mt-2 text-sm text-destructive">{job.error}</p> : null}
                    <a
                      href={`/api/courses/${courseId}/files/${file.id}`}
                      className="mt-2 inline-block text-sm underline-offset-4 hover:underline"
                    >
                      Open file
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question</CardTitle>
          <CardDescription>Answers come only from this course, with citations</CardDescription>
        </CardHeader>
        <CardContent>
          <ChatPanel courseId={courseId} />
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <h2 className="text-lg font-medium">Course memory</h2>
        {activeItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Structured items appear after a transcript is processed.
          </p>
        ) : (
          <ul className="grid gap-3">
            {activeItems.map((item) => (
              <li key={item.id} className="rounded-xl border border-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{ITEM_TYPE_LABELS[item.item_type as ItemType]}</Badge>
                  <Badge variant="secondary">{ITEM_STATUS_LABELS[item.status as ItemStatus]}</Badge>
                  {item.start_ms != null ? (
                    <span className="text-xs text-muted-foreground">{formatTimestamp(item.start_ms)}</span>
                  ) : null}
                </div>
                <p className="mt-2 font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
                {item.excerpt ? <p className="mt-2 text-sm">{item.excerpt}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-medium">Memory history</h2>
        {(versions ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes yet.</p>
        ) : (
          <ul className="grid gap-2">
            {(versions ?? []).map((version) => {
              const snapshot = version.snapshot as { title?: string };
              const action = version.action as keyof typeof VERSION_ACTION_LABELS;
              return (
                <li key={version.id} className="text-sm">
                  <span className="font-medium">{VERSION_ACTION_LABELS[action] ?? version.action}</span>
                  {snapshot.title ? ` — ${snapshot.title}` : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
