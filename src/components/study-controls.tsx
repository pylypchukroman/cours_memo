"use client";

import { deleteLesson, rebuildStudyPack, setStudyState } from "@/app/courses/study-actions";
import { Button } from "@/components/ui/button";
import {
  COMPLETION_STATUSES,
  REVIEW_STATUSES,
  type CompletionStatus,
  type ReviewStatus,
} from "@/lib/study/types";

const COMPLETION_LABELS: Record<CompletionStatus, string> = {
  todo: "To do",
  done: "Done",
  unknown: "Unknown",
};

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  corrected: "Corrected",
  dismissed: "Dismissed",
};

export function ConfirmSubmit({
  action,
  label,
  message,
  courseId,
  sourceFileId,
  variant = "outline",
}: {
  action: typeof deleteLesson | typeof rebuildStudyPack;
  label: string;
  message: string;
  courseId: string;
  sourceFileId: string;
  variant?: "outline" | "destructive";
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sourceFileId" value={sourceFileId} />
      <Button type="submit" variant={variant} size="sm">
        {label}
      </Button>
    </form>
  );
}

export function StudyStateForm({
  courseId,
  sourceFileId,
  itemKey,
  completionStatus,
  reviewStatus,
  note,
}: {
  courseId: string;
  sourceFileId: string;
  itemKey: string;
  completionStatus: CompletionStatus;
  reviewStatus: ReviewStatus;
  note: string | null;
}) {
  return (
    <form key={`${completionStatus}:${reviewStatus}:${note ?? ""}`} action={setStudyState} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sourceFileId" value={sourceFileId} />
      <input type="hidden" name="itemKey" value={itemKey} />
      <label className="grid gap-1 text-xs text-muted-foreground">
        Completion
        <select
          name="completionStatus"
          defaultValue={completionStatus}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
        >
          {COMPLETION_STATUSES.map((status) => (
            <option key={status} value={status}>{COMPLETION_LABELS[status]}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Review
        <select
          name="reviewStatus"
          defaultValue={reviewStatus}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
        >
          {REVIEW_STATUSES.map((status) => (
            <option key={status} value={status}>{REVIEW_LABELS[status]}</option>
          ))}
        </select>
      </label>
      <label className="grid min-w-40 flex-1 gap-1 text-xs text-muted-foreground">
        Your note
        <input
          name="note"
          defaultValue={note ?? ""}
          maxLength={2000}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
        />
      </label>
      <Button type="submit" size="sm" variant="secondary">
        Save
      </Button>
    </form>
  );
}
