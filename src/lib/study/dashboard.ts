import type { StudyPack, StudyTask } from "@/lib/study/types";

export type DashboardLesson = {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  unitCode: string | null;
  pack: StudyPack;
};

export type DashboardItem = {
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  unitCode: string | null;
  itemKey: string;
  title: string;
  kind: "task" | "review";
  detail: string;
  dueDate: string | null;
};

function visible(task: StudyTask): boolean {
  return task.review_status !== "dismissed" && task.completion_status !== "done";
}

export function collectDashboard(lessons: DashboardLesson[]): {
  outstanding: DashboardItem[];
  optional: DashboardItem[];
  deadlines: DashboardItem[];
  review: DashboardItem[];
} {
  const outstanding: DashboardItem[] = [];
  const optional: DashboardItem[] = [];
  const deadlines: DashboardItem[] = [];
  const review: DashboardItem[] = [];

  for (const lesson of lessons) {
    for (const task of lesson.pack.tasks) {
      if (!visible(task) || task.timing === "during_lesson" || task.extracted_completion === "done_in_class") {
        continue;
      }
      const item: DashboardItem = {
        courseId: lesson.courseId,
        courseTitle: lesson.courseTitle,
        lessonId: lesson.lessonId,
        lessonTitle: lesson.lessonTitle,
        unitCode: lesson.unitCode,
        itemKey: task.item_key,
        title: task.title,
        kind: "task",
        detail: task.requirement_level,
        dueDate: task.due.date,
      };
      if (task.requirement_level === "required" && task.timing === "assigned_later") {
        outstanding.push(item);
      } else if (task.requirement_level === "optional") {
        optional.push(item);
      }
      if (task.due.date && task.review_status === "confirmed") {
        deadlines.push(item);
      }
      if (task.evidence_quality !== "clear" || task.review_flags.length > 0) {
        review.push({ ...item, kind: "review", detail: task.review_flags[0] ?? task.evidence_quality });
      }
    }

    for (const conflict of lesson.pack.conflicts) {
      review.push({
        courseId: lesson.courseId,
        courseTitle: lesson.courseTitle,
        lessonId: lesson.lessonId,
        lessonTitle: lesson.lessonTitle,
        unitCode: lesson.unitCode,
        itemKey: conflict.description.slice(0, 16),
        title: conflict.description,
        kind: "review",
        detail: "conflict",
        dueDate: null,
      });
    }
  }

  return { outstanding, optional, deadlines, review };
}

export function dueWithinDays(date: string, from: string, days: number): boolean {
  const start = Date.parse(`${from}T00:00:00Z`);
  const target = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(target)) {
    return false;
  }
  const diff = (target - start) / 86_400_000;
  return diff >= 0 && diff <= days;
}
