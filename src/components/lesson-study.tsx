import { ConfirmSubmit, StudyStateForm } from "@/components/study-controls";
import { Badge } from "@/components/ui/badge";
import { deleteLesson, rebuildStudyPack } from "@/app/courses/study-actions";
import type { ItemState, StudyPack } from "@/lib/study/types";
import { formatTimestamp } from "@/lib/time";

function Sources({ sources }: { sources: Array<{ quote: string; start_ms: number | null; end_ms: number | null; segment_id: string }> }) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <ul className="mt-2 grid gap-2">
      {sources.map((source) => (
        <li key={`${source.segment_id}:${source.quote}`}>
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Source
              {source.start_ms != null ? ` · ${formatTimestamp(source.start_ms)}` : " · no timestamp"}
            </summary>
            <blockquote className="mt-2 border-l-2 border-border pl-3">{source.quote}</blockquote>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function LessonStudy({
  courseId,
  sourceFileId,
  title,
  unitCode,
  subject,
  lessonDate,
  pack,
  states,
}: {
  courseId: string;
  sourceFileId: string;
  title: string;
  unitCode: string | null;
  subject: string | null;
  lessonDate: string | null;
  pack: StudyPack | null;
  states: Record<string, ItemState>;
}) {
  return (
    <article id={`lesson-${sourceFileId}`} className="grid gap-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {[subject, unitCode, lessonDate].filter(Boolean).join(" · ") || "No unit or date"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pack ? (
            <>
              <a className="text-sm underline-offset-4 hover:underline" href={`/api/courses/${courseId}/study/${sourceFileId}?format=md`}>
                Markdown
              </a>
              <a className="text-sm underline-offset-4 hover:underline" href={`/api/courses/${courseId}/study/${sourceFileId}?format=json`}>
                JSON
              </a>
            </>
          ) : null}
          <ConfirmSubmit
            action={rebuildStudyPack}
            label="Rebuild study pack"
            message="Rebuild study materials for this lesson? Your completion marks and notes stay."
            courseId={courseId}
            sourceFileId={sourceFileId}
          />
          <ConfirmSubmit
            action={deleteLesson}
            label="Delete lesson"
            message="Delete this lesson and its derived study materials?"
            courseId={courseId}
            sourceFileId={sourceFileId}
            variant="destructive"
          />
        </div>
      </div>

      {!pack ? (
        <p className="text-sm text-muted-foreground">Study materials appear after processing finishes.</p>
      ) : (
        <div className="grid gap-3">
          {pack.processing_warnings.length > 0 ? (
            <ul className="grid gap-1 text-sm text-muted-foreground">
              {pack.processing_warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <details open>
            <summary className="cursor-pointer font-medium">Overview</summary>
            <p className="mt-2 text-sm">{pack.overview.summary ?? "No verified summary."}</p>
            {pack.overview.topics.length > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{pack.overview.topics.join(" · ")}</p>
            ) : null}
          </details>

          <details>
            <summary className="cursor-pointer font-medium">Tasks ({pack.tasks.length})</summary>
            <ul className="mt-3 grid gap-3">
              {pack.tasks.map((task) => {
                const state = states[task.item_key];
                const completion = state?.completionStatus ?? task.completion_status;
                const review = state?.reviewStatus ?? task.review_status;
                return (
                  <li key={task.id} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{task.requirement_level}</Badge>
                      <Badge variant="secondary">{task.timing === "during_lesson" ? "During class" : task.timing === "assigned_later" ? "Assigned later" : "Timing unknown"}</Badge>
                      <Badge variant="secondary">{task.origin}</Badge>
                      {task.evidence_quality !== "clear" ? <Badge variant="destructive">{task.evidence_quality}</Badge> : null}
                    </div>
                    <p className="mt-2 font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                    <p className="mt-2 text-sm">
                      {task.due.original_text ? `Deadline wording: ${task.due.original_text}` : "No deadline was stated."}
                      {task.due.date ? ` Resolved date: ${task.due.date}.` : ""}
                      {task.due.resolution_note ? ` ${task.due.resolution_note}` : ""}
                    </p>
                    {task.extracted_completion === "done_in_class" ? (
                      <p className="mt-1 text-sm">The transcript describes this as already done in class.</p>
                    ) : null}
                    {task.review_flags.map((flag) => (
                      <p key={flag} className="mt-1 text-sm text-destructive">{flag}</p>
                    ))}
                    <Sources sources={task.sources} />
                    {state?.note ? <p className="mt-2 text-sm">Your note: {state.note}</p> : null}
                    <StudyStateForm
                      courseId={courseId}
                      sourceFileId={sourceFileId}
                      itemKey={task.item_key}
                      completionStatus={completion}
                      reviewStatus={review}
                      note={state?.note ?? null}
                    />
                  </li>
                );
              })}
            </ul>
          </details>

          <details>
            <summary className="cursor-pointer font-medium">Assessments ({pack.assessments.length})</summary>
            <ul className="mt-3 grid gap-3">
              {pack.assessments.map((assessment) => (
                <li key={assessment.id} className="rounded-lg border border-border p-3">
                  <p className="font-medium">{assessment.title}</p>
                  <p className="text-sm text-muted-foreground">{assessment.origin} · {assessment.evidence_quality}</p>
                  {assessment.conflicts.map((conflict) => (
                    <p key={conflict.description} className="mt-2 text-sm text-destructive">{conflict.description}</p>
                  ))}
                  <ul className="mt-2 grid gap-2">
                    {assessment.checklist.map((item) => {
                      const state = states[item.item_key];
                      return (
                        <li key={item.item_key}>
                          <p className="text-sm">{item.label}</p>
                          <StudyStateForm
                            courseId={courseId}
                            sourceFileId={sourceFileId}
                            itemKey={item.item_key}
                            completionStatus={state?.completionStatus ?? "todo"}
                            reviewStatus={state?.reviewStatus ?? "pending"}
                            note={state?.note ?? null}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  <Sources sources={assessment.sources} />
                </li>
              ))}
            </ul>
          </details>

          <details>
            <summary className="cursor-pointer font-medium">Lab guides ({pack.lab_guides.length})</summary>
            <ul className="mt-3 grid gap-3">
              {pack.lab_guides.map((guide) => (
                <li key={guide.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <p className="font-medium">{guide.title}</p>
                    {guide.incomplete ? <Badge variant="destructive">Incomplete</Badge> : null}
                  </div>
                  <p className="mt-2">{guide.objective}</p>
                  <ol className="mt-2 grid list-decimal gap-1 pl-5">
                    {guide.steps.map((step) => (
                      <li key={step.text}>
                        {step.text}
                        {step.origin === "generated" ? " (added by the assistant, not stated by the teacher)" : ""}
                      </li>
                    ))}
                  </ol>
                  {guide.missing_information.length > 0 ? (
                    <p className="mt-2 text-muted-foreground">Needs confirmation: {guide.missing_information.join("; ")}</p>
                  ) : null}
                  <Sources sources={guide.sources} />
                </li>
              ))}
            </ul>
          </details>

          <details>
            <summary className="cursor-pointer font-medium">Commands, glossary, and troubleshooting</summary>
            <div className="mt-3 grid gap-3 text-sm">
              {pack.commands_and_code.map((command) => (
                <div key={command.id} className="rounded-lg border border-border p-3">
                  <pre className="overflow-x-auto whitespace-pre-wrap">{command.source_text}</pre>
                  <p className="mt-2 text-muted-foreground">{command.purpose}</p>
                  {command.proposed_correction ? (
                    <p className="mt-2">Unverified suggestion: {command.proposed_correction}</p>
                  ) : null}
                  {command.caution ? <p className="mt-2 text-destructive">{command.caution}</p> : null}
                  <Sources sources={command.sources} />
                </div>
              ))}
              {pack.glossary.map((entry) => (
                <div key={entry.id}>
                  <p className="font-medium">{entry.term}{entry.acronym_expansion ? ` (${entry.acronym_expansion})` : ""}</p>
                  <p>{entry.explanation}</p>
                  <p className="text-muted-foreground">{entry.origin === "generated" ? "Assistant explanation" : "From the lesson"}</p>
                </div>
              ))}
              {pack.troubleshooting_entries.map((entry) => (
                <div key={entry.id}>
                  <p className="font-medium">{entry.symptoms}</p>
                  <p>{entry.confirmed_resolution ? `Demonstrated fix: ${entry.confirmed_resolution}` : "No demonstrated fix was recorded."}</p>
                  <Sources sources={entry.sources} />
                </div>
              ))}
            </div>
          </details>

          <details>
            <summary className="cursor-pointer font-medium">Revision</summary>
            <ul className="mt-3 grid gap-3 text-sm">
              {pack.flashcards.map((card) => (
                <li key={card.id}>
                  <details>
                    <summary className="cursor-pointer">{card.front}{card.extension ? " · extension practice" : ""}</summary>
                    <p className="mt-2">{card.back}</p>
                    <p className="text-muted-foreground">{card.explanation}</p>
                  </details>
                </li>
              ))}
              {pack.quiz_questions.map((question) => (
                <li key={question.id}>
                  <p>{question.prompt}{question.extension ? " · extension practice" : ""}</p>
                  {question.choices.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5">
                      {question.choices.map((choice) => (
                        <li key={choice}>{choice}</li>
                      ))}
                    </ul>
                  ) : null}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground">Show answer</summary>
                    <p className="mt-1">{question.answer}</p>
                    <p className="text-muted-foreground">{question.explanation}</p>
                    <Sources sources={question.sources} />
                  </details>
                </li>
              ))}
            </ul>
          </details>

          <details>
            <summary className="cursor-pointer font-medium">Questions for the teacher</summary>
            <ul className="mt-3 grid gap-2 text-sm">
              {pack.teacher_questions.map((question) => (
                <li key={question.id}>
                  <p>{question.text}</p>
                  <p className="text-muted-foreground">{question.origin === "generated" ? "Suggested question" : "From the lesson"} · {question.reason}</p>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </article>
  );
}
