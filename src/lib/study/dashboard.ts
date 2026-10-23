import type { StudyPack, StudyTask } from "@/lib/study/types";

type DashboardLesson = {
  lessonId: string;
  pack: StudyPack;
};

type DashboardItem = {
  lessonId: string;
  itemKey: string;
  title: string;
  dueDate: string | null;
};

function visible(task: StudyTask): boolean {
  return task.review_status !== "dismissed" && task.completion_status !== "done";
}

export function collectDashboard(lessons: DashboardLesson[]): {
  outstanding: DashboardItem[];
  reviewCount: number;
} {
  const outstanding: DashboardItem[] = [];
  let reviewCount = 0;

  for (const lesson of lessons) {
    for (const task of lesson.pack.tasks) {
      if (!visible(task) || task.timing === "during_lesson" || task.extracted_completion === "done_in_class") {
        continue;
      }
      const item: DashboardItem = {
        lessonId: lesson.lessonId,
        itemKey: task.item_key,
        title: task.title,
        dueDate: task.due.date,
      };
      if (task.requirement_level === "required" && task.timing === "assigned_later") {
        outstanding.push(item);
      }
      if (task.evidence_quality !== "clear" || task.review_flags.length > 0) {
        reviewCount += 1;
      }
    }

    reviewCount += lesson.pack.conflicts.length;
  }

  return { outstanding, reviewCount };
}
