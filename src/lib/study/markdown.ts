import type { StudyPack } from "@/lib/study/types";

function sources(items: Array<{ quote: string; start_ms: number | null }>): string {
  return items
    .map((item) => {
      const time = item.start_ms == null ? "no timestamp" : `${item.start_ms}ms`;
      return `> ${item.quote} (${time})`;
    })
    .join("\n");
}

export function studyPackMarkdown(title: string, pack: StudyPack): string {
  const lines = [`# ${title}`, "", pack.overview.summary ?? "_No verified summary._", ""];

  if (pack.overview.topics.length > 0) {
    lines.push("## Topics", ...pack.overview.topics.map((topic) => `- ${topic}`), "");
  }

  lines.push("## Tasks");
  for (const task of pack.tasks) {
    lines.push(
      `### ${task.title}`,
      "",
      `${task.requirement_level} · ${task.timing} · ${task.origin} · ${task.evidence_quality}`,
      "",
      task.description,
      "",
      task.due.original_text ? `Deadline wording: ${task.due.original_text}` : "Deadline: not stated",
      task.due.date ? `Resolved date: ${task.due.date}` : "Resolved date: none",
      task.due.resolution_note ?? "",
      "",
      sources(task.sources),
      "",
    );
  }

  lines.push("## Assessments");
  for (const assessment of pack.assessments) {
    lines.push(`### ${assessment.title}`, "", ...assessment.checklist.map((item) => `- [ ] ${item.label}`), "", sources(assessment.sources), "");
    for (const conflict of assessment.conflicts) {
      lines.push(`Conflict: ${conflict.description}`, sources(conflict.sources), "");
    }
  }

  lines.push("## Lab guides");
  for (const guide of pack.lab_guides) {
    lines.push(`### ${guide.title}`, "", guide.incomplete ? "Incomplete. Confirm the missing information before relying on this guide." : "Grounded in the lesson.", "");
    for (const step of guide.steps) {
      const label = step.origin === "generated" ? " (added by the assistant)" : "";
      lines.push(`- ${step.text}${label}`);
    }
    lines.push("", sources(guide.sources), "");
  }

  lines.push("## Commands");
  for (const command of pack.commands_and_code) {
    lines.push("```", command.source_text, "```", "");
    if (command.proposed_correction) {
      lines.push(`Unverified suggestion: \`${command.proposed_correction}\``, "");
    }
    if (command.caution) {
      lines.push(command.caution, "");
    }
  }

  return lines.filter((line) => line !== undefined).join("\n");
}
