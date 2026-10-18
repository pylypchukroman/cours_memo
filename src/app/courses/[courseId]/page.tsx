import Link from "next/link";
import { notFound } from "next/navigation";

import { ChatPanel } from "@/components/chat-panel";
import { JobPoller } from "@/components/job-poller";
import { LessonStudy } from "@/components/lesson-study";
import { UploadForm } from "@/components/upload-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCourseMember } from "@/lib/courses";
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS, VERSION_ACTION_LABELS } from "@/lib/memory/labels";
import type { ItemStatus, ItemType } from "@/lib/memory/types";
import { collectDashboard } from "@/lib/study/dashboard";
import type { ItemState, ReviewStatus, StudyPack } from "@/lib/study/types";
import { isCompletionStatus, isStudyPack, overlayStudyState } from "@/lib/study/validate";
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
  const [{ data: course }, { data: files }, { data: jobs }, { data: items }, { data: versions }, { data: packs }, { data: states }] =
    await Promise.all([
      supabase.from("courses").select("title, description").eq("id", courseId).single(),
      supabase
        .from("source_files")
        .select("id, original_name, lesson_title, lesson_date, unit_code, subject, byte_size, created_at")
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
      supabase.from("lesson_study_packs").select("source_file_id, pack").eq("course_id", courseId),
      supabase
        .from("study_item_states")
        .select("source_file_id, item_key, completion_status, review_status, note")
        .eq("course_id", courseId),
    ]);

  if (!course) {
    notFound();
  }

  const jobsByFile = new Map((jobs ?? []).map((job) => [job.source_file_id, job]));
  const activeJob = (jobs ?? []).some((job) => job.status === "pending" || job.status === "running");
  const activeItems = (items ?? []).filter((item) => item.status === "active");
  const packByFile = new Map(
    (packs ?? []).flatMap((row) => (isStudyPack(row.pack) ? [[row.source_file_id, row.pack as StudyPack] as const] : [])),
  );
  const stateRows = states ?? [];
  const reviews = new Set<ReviewStatus>(["pending", "confirmed", "corrected", "dismissed"]);
  const dashboard = collectDashboard(
    (files ?? []).flatMap((file) => {
      const pack = packByFile.get(file.id);
      if (!pack) {
        return [];
      }
      const overlay: Record<string, ItemState> = {};
      for (const state of stateRows) {
        if (state.source_file_id !== file.id || !isCompletionStatus(state.completion_status) || !reviews.has(state.review_status as ReviewStatus)) {
          continue;
        }
        overlay[state.item_key] = {
          completionStatus: state.completion_status,
          reviewStatus: state.review_status as ReviewStatus,
          note: state.note,
        };
      }
      return [
        {
          courseId,
          courseTitle: course.title,
          lessonId: file.id,
          lessonTitle: file.lesson_title || file.original_name,
          unitCode: file.unit_code,
          pack: overlayStudyState(pack, overlay),
        },
      ];
    }),
  );

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-10">
      <JobPoller active={activeJob} />
      <div className="grid gap-2">
        <Link href="/courses" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          All courses
        </Link>
        <h1 className="text-3xl font-semibold">{course.title}</h1>
        {course.description ? <p className="text-muted-foreground">{course.description}</p> : null}
        <a className="text-sm text-muted-foreground underline-offset-4 hover:underline" href={`/api/courses/${courseId}/calendar`}>
          Download confirmed deadlines
        </a>
      </div>

      <section className="grid gap-3">
        <h2 className="text-lg font-medium">To do</h2>
        {dashboard.outstanding.length === 0 ? (
          <p className="text-sm text-muted-foreground">No required work assigned for later is still open.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {dashboard.outstanding.map((item) => (
              <li key={item.itemKey}>
                <a className="underline-offset-4 hover:underline" href={`#lesson-${item.lessonId}`}>
                  {item.title}
                </a>
                {item.dueDate ? ` · ${item.dueDate}` : ""}
              </li>
            ))}
          </ul>
        )}
        {dashboard.review.length > 0 ? (
          <p className="text-sm text-muted-foreground">{dashboard.review.length} items need review because a date, requirement, or quote is uncertain.</p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>.vtt or .txt, up to 5 MB</CardDescription>
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
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Card>
        <CardHeader>
        <CardTitle>Ask my lessons</CardTitle>
        <CardDescription>Answers cite this course. Add a unit code to limit the search.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChatPanel courseId={courseId} />
        </CardContent>
      </Card>

      <section className="grid gap-4">
        <h2 className="text-lg font-medium">Lesson study</h2>
        {(files ?? []).map((file) => {
          const overlay: Record<string, ItemState> = {};
          for (const state of stateRows) {
            if (state.source_file_id !== file.id || !isCompletionStatus(state.completion_status) || !reviews.has(state.review_status as ReviewStatus)) {
              continue;
            }
            overlay[state.item_key] = {
              completionStatus: state.completion_status,
              reviewStatus: state.review_status as ReviewStatus,
              note: state.note,
            };
          }
          const pack = packByFile.get(file.id) ?? null;
          return (
            <LessonStudy
              key={file.id}
              courseId={courseId}
              sourceFileId={file.id}
              title={file.lesson_title || file.original_name}
              unitCode={file.unit_code}
              subject={file.subject}
              lessonDate={file.lesson_date}
              pack={pack ? overlayStudyState(pack, overlay) : null}
              states={overlay}
            />
          );
        })}
      </section>

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
