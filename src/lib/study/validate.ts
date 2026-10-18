import { createHash } from "node:crypto";

import { resolveDue } from "@/lib/study/dates";
import {
  EVIDENCE_QUALITIES,
  EXTRACTED_COMPLETIONS,
  ORIGINS,
  REQUIREMENT_LEVELS,
  SCHEMA_VERSION,
  TASK_CATEGORIES,
  TASK_TIMINGS,
  type CompletionStatus,
  type DraftSource,
  type EvidenceQuality,
  type ItemState,
  type Origin,
  type RequirementLevel,
  type SourceRef,
  type StudyAssessment,
  type StudyConflict,
  type StudyContext,
  type StudyDraft,
  type StudyPack,
  type StudyTask,
  type TaskCategory,
  type TaskTiming,
} from "@/lib/study/types";

const EMBEDDED_INSTRUCTION =
  /ignore (all |any )?(previous|prior|above) instructions|you are now|system prompt|mark every task complete|disregard the transcript/i;

const RISKY_COMMAND =
  /\b(rm\s+-[a-z]*|rmdir|drop\s+(table|database)|truncate\s+table|chmod\s+[0-7]*7|mkfs|shutdown|reboot|iptables\s+-F|terraform\s+destroy|dd\s+if=)\b/i;

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function itemKey(kind: string, title: string): string {
  const normalized = collapse(title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return createHash("sha256").update(`${kind}:${normalized}`).digest("hex").slice(0, 16);
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.some((item) => item === value) ? (value as T) : fallback;
}

function bindSources(sources: DraftSource[], context: StudyContext, warnings: string[]): SourceRef[] {
  const bound: SourceRef[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    const segment = context.segments.find((item) => item.ordinal === source.segment_ordinal);
    const quote = collapse(source.quote ?? "");
    if (!segment || quote.length < 12) {
      warnings.push("Dropped a source whose quote was missing or too short to verify.");
      continue;
    }
    if (!collapse(segment.text).includes(quote)) {
      warnings.push("Dropped a source whose quote does not appear in the cited segment.");
      continue;
    }
    const key = `${segment.id}:${quote}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    bound.push({
      lesson_id: context.lessonId,
      segment_id: segment.id,
      start_ms: segment.startMs,
      end_ms: segment.endMs,
      quote,
    });
  }

  return bound;
}

function notes(
  items: Array<{ text: string; sources: DraftSource[] }>,
  origin: Origin,
  context: StudyContext,
  warnings: string[],
) {
  return items.flatMap((item) => {
    const text = collapse(item.text);
    const sources = bindSources(item.sources, context, warnings);
    if (!text || sources.length === 0) {
      return [];
    }
    return [{ text, origin, sources }];
  });
}

function checklist(title: string, kind: StudyAssessment["checklist"][number]["kind"], labels: string[]) {
  return labels
    .map((label) => collapse(label))
    .filter(Boolean)
    .map((label) => ({
      item_key: itemKey(`check:${kind}`, `${title}:${label}`),
      label,
      kind,
    }));
}

function cautionFor(command: string): string | null {
  if (!RISKY_COMMAND.test(command)) {
    return null;
  }
  return "This command can delete data, change access, or disrupt a system. Review it before running it. Course Memo does not run extracted commands.";
}

function sameDue(left: string | null, right: string | null): boolean {
  return collapse(left ?? "") === collapse(right ?? "");
}

export function buildStudyPack(draft: StudyDraft, context: StudyContext): StudyPack {
  const warnings: string[] = [];
  const summarySources = bindSources(draft.overview.summary_sources, context, warnings);
  const summary = summarySources.length > 0 ? collapse(draft.overview.summary) || null : null;
  if (!summary && collapse(draft.overview.summary)) {
    warnings.push("The summary was dropped because none of its quotes matched the transcript.");
  }

  const tasks: StudyTask[] = [];
  for (const task of draft.tasks) {
    const title = collapse(task.title);
    const description = collapse(task.description);
    if (!title || EMBEDDED_INSTRUCTION.test(`${title} ${description}`)) {
      warnings.push("Ignored an instruction embedded in the transcript.");
      continue;
    }
    const sources = bindSources(task.sources, context, warnings);
    if (sources.length === 0) {
      warnings.push(`Dropped “${title}” because it had no matching transcript quote.`);
      continue;
    }
    const due = resolveDue(task.due_text, context.lessonDate, context.timezone);
    const extracted = oneOf(task.extracted_completion, EXTRACTED_COMPLETIONS, "unknown");
    tasks.push({
      id: `task_${itemKey("task", title)}`,
      item_key: itemKey("task", title + (due.original_text ?? "")),
      title,
      description,
      category: oneOf(task.category, TASK_CATEGORIES, "other"),
      requirement_level: oneOf(task.requirement_level, REQUIREMENT_LEVELS, "required"),
      timing: oneOf(task.timing, TASK_TIMINGS, "unknown"),
      origin: oneOf(task.origin, ORIGINS, "explicit"),
      evidence_quality: oneOf(task.evidence_quality, EVIDENCE_QUALITIES, "ambiguous"),
      due,
      extracted_completion: extracted,
      completion_status: extracted === "done_in_class" ? "done" : extracted === "todo" ? "todo" : "unknown",
      review_status: "pending",
      dependencies: task.dependency_titles
        .map((dependency) => collapse(dependency))
        .filter(Boolean)
        .map((dependency) => ({ title: dependency, origin: "explicit" as const })),
      sources,
      review_flags: task.review_flags.map(collapse).filter(Boolean),
    });
  }

  const deduped: StudyTask[] = [];
  for (const task of tasks) {
    const match = deduped.find(
      (existing) =>
        itemKey("title", existing.title) === itemKey("title", task.title) &&
        sameDue(existing.due.original_text, task.due.original_text),
    );
    if (!match) {
      deduped.push(task);
      continue;
    }
    for (const source of task.sources) {
      if (!match.sources.some((item) => item.segment_id === source.segment_id && item.quote === source.quote)) {
        match.sources.push(source);
      }
    }
    warnings.push(`Combined repeated mentions of “${task.title}”.`);
  }

  const conflicts: StudyConflict[] = draft.conflicts.flatMap((conflict) => {
    const description = collapse(conflict.description);
    const sources = bindSources(conflict.sources, context, warnings);
    return description && sources.length > 0 ? [{ description, sources }] : [];
  });

  const titles = new Map<string, StudyTask[]>();
  for (const task of deduped) {
    const key = itemKey("title", task.title);
    titles.set(key, [...(titles.get(key) ?? []), task]);
  }
  for (const group of titles.values()) {
    if (group.length < 2) {
      continue;
    }
    const descriptions = group.map(
      (task) => `${task.title}: ${task.due.original_text ?? "no deadline stated"}`,
    );
    conflicts.push({
      description: `The transcript gives more than one version of this task. Neither version was marked superseded. ${descriptions.join(" · ")}`,
      sources: group.flatMap((task) => task.sources),
    });
    for (const task of group) {
      task.evidence_quality = "conflicting";
      task.review_flags.push("Conflicting requirement. Confirm which version applies.");
    }
  }

  const assessments: StudyAssessment[] = draft.assessments.flatMap((assessment) => {
    const title = collapse(assessment.title);
    if (!title || EMBEDDED_INSTRUCTION.test(title)) {
      warnings.push("Ignored an instruction embedded in the transcript.");
      return [];
    }
    const sources = bindSources(assessment.sources, context, warnings);
    if (sources.length === 0) {
      warnings.push(`Dropped assessment “${title}” because it had no matching transcript quote.`);
      return [];
    }
    const mustSubmit = assessment.must_submit.map(collapse).filter(Boolean);
    const files = assessment.required_files.map(collapse).filter(Boolean);
    const evidence = assessment.required_evidence.map(collapse).filter(Boolean);
    const demonstrations = assessment.demonstrations.map(collapse).filter(Boolean);
    const criteria = assessment.marking_criteria.map(collapse).filter(Boolean);
    return [
      {
        id: `assessment_${itemKey("assessment", title)}`,
        item_key: itemKey("assessment", title),
        title,
        must_submit: mustSubmit,
        submission_format: collapse(assessment.submission_format ?? "") || null,
        submission_location: collapse(assessment.submission_location ?? "") || null,
        due: resolveDue(assessment.due_text, context.lessonDate, context.timezone),
        required_files: files,
        required_evidence: evidence,
        demonstrations,
        marking_criteria: criteria,
        teacher_clarifications: assessment.teacher_clarifications.map(collapse).filter(Boolean),
        common_mistakes: assessment.common_mistakes.map(collapse).filter(Boolean),
        tools: assessment.tools.map(collapse).filter(Boolean),
        origin: oneOf(assessment.origin, ORIGINS, "explicit"),
        evidence_quality: oneOf(assessment.evidence_quality, EVIDENCE_QUALITIES, "ambiguous"),
        checklist: [
          ...checklist(title, "submit", mustSubmit),
          ...checklist(title, "file", files),
          ...checklist(title, "evidence", evidence),
          ...checklist(title, "demo", demonstrations),
          ...checklist(title, "criterion", criteria),
        ],
        conflicts: assessment.conflicts.flatMap((conflict) => {
          const description = collapse(conflict.description);
          const conflictSources = bindSources(conflict.sources, context, warnings);
          return description && conflictSources.length > 0 ? [{ description, sources: conflictSources }] : [];
        }),
        sources,
        review_flags: assessment.review_flags.map(collapse).filter(Boolean),
      },
    ];
  });

  const labGuides = draft.lab_guides.flatMap((guide) => {
    const title = collapse(guide.title);
    const sources = bindSources(guide.sources, context, warnings);
    if (!title || sources.length === 0) {
      if (title) {
        warnings.push(`Dropped lab guide “${title}” because it had no matching transcript quote.`);
      }
      return [];
    }
    const missing = guide.missing_information.map(collapse).filter(Boolean);
    return [
      {
        id: `lab_${itemKey("lab", title)}`,
        item_key: itemKey("lab", title),
        title,
        objective: collapse(guide.objective),
        prerequisites: guide.prerequisites.map(collapse).filter(Boolean),
        tools: guide.tools.map(collapse).filter(Boolean),
        steps: guide.steps.flatMap((step) => {
          const text = collapse(step.text);
          if (!text) {
            return [];
          }
          return [{ text, origin: step.origin === "generated" ? ("generated" as const) : ("explicit" as const) }];
        }),
        expected_results: guide.expected_results.map(collapse).filter(Boolean),
        verification: guide.verification.map(collapse).filter(Boolean),
        troubleshooting: guide.troubleshooting.map(collapse).filter(Boolean),
        evidence_to_save: guide.evidence_to_save.map(collapse).filter(Boolean),
        cleanup: guide.cleanup.map(collapse).filter(Boolean),
        incomplete: guide.incomplete || missing.length > 0,
        missing_information: missing,
        sources,
      },
    ];
  });

  const commands = draft.commands_and_code.flatMap((command) => {
    const sourceText = command.source_text.trim();
    const sources = bindSources(command.sources, context, warnings);
    const exact = collapse(sourceText);
    const quoted = sources.some((source) => source.quote.includes(exact) || exact.includes(source.quote));
    if (!sourceText || sources.length === 0 || !quoted) {
      if (sourceText) {
        warnings.push("Dropped a command because its text did not match a transcript quote.");
      }
      return [];
    }
    const correction = collapse(command.proposed_correction ?? "") || null;
    return [
      {
        id: `command_${itemKey("command", sourceText)}`,
        item_key: itemKey("command", sourceText),
        source_text: sourceText,
        language: collapse(command.language ?? "") || null,
        purpose: collapse(command.purpose),
        placeholders: command.placeholders.map(collapse).filter(Boolean),
        expected_result: collapse(command.expected_result ?? "") || null,
        proposed_correction: correction && correction !== collapse(sourceText) ? correction : null,
        caution: cautionFor(sourceText) ?? (correction ? cautionFor(correction) : null),
        sources,
        review_flags: [
          ...command.review_flags.map(collapse).filter(Boolean),
          ...(correction ? ["Correction is unverified. The transcript text is unchanged."] : []),
        ],
      },
    ];
  });

  const troubleshooting = draft.troubleshooting_entries.flatMap((entry) => {
    const symptoms = collapse(entry.symptoms);
    const sources = bindSources(entry.sources, context, warnings);
    if (!symptoms || sources.length === 0) {
      return [];
    }
    return [
      {
        id: `trouble_${itemKey("trouble", symptoms)}`,
        item_key: itemKey("trouble", symptoms),
        symptoms,
        environment: collapse(entry.environment ?? "") || null,
        causes: entry.causes.map(collapse).filter(Boolean),
        diagnostic_steps: entry.diagnostic_steps.map(collapse).filter(Boolean),
        attempted_fixes: entry.attempted_fixes.map(collapse).filter(Boolean),
        confirmed_resolution: collapse(entry.confirmed_resolution ?? "") || null,
        prevention: collapse(entry.prevention ?? "") || null,
        sources,
      },
    ];
  });

  const glossary = draft.glossary.flatMap((entry) => {
    const term = collapse(entry.term);
    const sources = bindSources(entry.sources, context, warnings);
    if (!term || sources.length === 0) {
      return [];
    }
    return [
      {
        id: `term_${itemKey("term", term)}`,
        item_key: itemKey("term", term),
        term,
        acronym_expansion: collapse(entry.acronym_expansion ?? "") || null,
        explanation: collapse(entry.explanation),
        example: collapse(entry.example ?? "") || null,
        related_terms: entry.related_terms.map(collapse).filter(Boolean),
        origin: oneOf(entry.origin, ORIGINS, "generated"),
        sources,
      },
    ];
  });

  const cards = draft.flashcards.flatMap((card) => {
    const front = collapse(card.front);
    const sources = bindSources(card.sources, context, warnings);
    if (!front || (!card.extension && sources.length === 0)) {
      return [];
    }
    return [
      {
        id: `card_${itemKey("card", front)}`,
        item_key: itemKey("card", front),
        front,
        back: collapse(card.back),
        explanation: collapse(card.explanation),
        extension: card.extension,
        sources,
      },
    ];
  });

  const quiz = draft.quiz_questions.flatMap((question) => {
    const prompt = collapse(question.prompt);
    const sources = bindSources(question.sources, context, warnings);
    if (!prompt || (!question.extension && sources.length === 0)) {
      return [];
    }
    const kind: "multiple_choice" | "short_answer" | "scenario" =
      question.kind === "multiple_choice" || question.kind === "scenario" ? question.kind : "short_answer";
    return [
      {
        id: `quiz_${itemKey("quiz", prompt)}`,
        item_key: itemKey("quiz", prompt),
        prompt,
        kind,
        choices: question.choices.map(collapse).filter(Boolean),
        answer: collapse(question.answer),
        explanation: collapse(question.explanation),
        extension: question.extension || sources.length === 0,
        sources,
      },
    ];
  });

  const teacherQuestions = draft.teacher_questions.flatMap((question) => {
    const text = collapse(question.text);
    if (!text || EMBEDDED_INSTRUCTION.test(text)) {
      return [];
    }
    const sources = bindSources(question.sources, context, warnings);
    const origin = question.origin === "explicit" && sources.length > 0 ? "explicit" : "generated";
    if (origin === "generated" && sources.length === 0 && !question.reason) {
      return [];
    }
    return [
      {
        id: `ask_${itemKey("ask", text)}`,
        item_key: itemKey("ask", text),
        text,
        reason: collapse(question.reason),
        origin: origin as "explicit" | "generated",
        sources,
      },
    ];
  });

  const uniqueWarnings = [...new Set(warnings)];
  const pack: StudyPack = {
    schema_version: SCHEMA_VERSION,
    lesson_id: context.lessonId,
    processing_status: uniqueWarnings.length > 0 ? "partial" : "completed",
    overview: {
      summary,
      topics: [...new Set(draft.overview.topics.map(collapse).filter(Boolean))],
      stated_objectives: notes(draft.overview.stated_objectives, "explicit", context, uniqueWarnings),
      suggested_objectives: notes(draft.overview.suggested_objectives, "generated", context, uniqueWarnings),
      explanations: notes(draft.overview.explanations, "explicit", context, uniqueWarnings),
      connections: notes(draft.overview.connections, "explicit", context, uniqueWarnings),
      unresolved_questions: notes(draft.overview.unresolved_questions, "explicit", context, uniqueWarnings),
    },
    tasks: deduped,
    assessments,
    lab_guides: labGuides,
    commands_and_code: commands,
    troubleshooting_entries: troubleshooting,
    glossary,
    flashcards: cards,
    quiz_questions: quiz,
    teacher_questions: teacherQuestions,
    cross_lesson_connections: notes(draft.overview.connections, "explicit", context, uniqueWarnings),
    conflicts,
    review_flags: [...new Set(draft.review_flags.map(collapse).filter(Boolean))],
    processing_warnings: [...new Set(uniqueWarnings)],
  };

  return pack;
}

export function overlayStudyState(pack: StudyPack, states: Record<string, ItemState>): StudyPack {
  return {
    ...pack,
    tasks: pack.tasks.map((task) => {
      const state = states[task.item_key];
      if (!state) {
        return task;
      }
      return {
        ...task,
        completion_status: state.completionStatus,
        review_status: state.reviewStatus,
      };
    }),
  };
}

export function emptyDraft(): StudyDraft {
  return {
    overview: {
      summary: "",
      summary_sources: [],
      topics: [],
      stated_objectives: [],
      suggested_objectives: [],
      explanations: [],
      connections: [],
      unresolved_questions: [],
    },
    tasks: [],
    assessments: [],
    lab_guides: [],
    commands_and_code: [],
    troubleshooting_entries: [],
    glossary: [],
    flashcards: [],
    quiz_questions: [],
    teacher_questions: [],
    conflicts: [],
    review_flags: [],
  };
}

export function mergeDrafts(drafts: StudyDraft[]): StudyDraft {
  const merged = emptyDraft();
  for (const draft of drafts) {
    if (draft.overview.summary && draft.overview.summary_sources.length >= merged.overview.summary_sources.length) {
      merged.overview.summary = draft.overview.summary;
      merged.overview.summary_sources = draft.overview.summary_sources;
    }
    merged.overview.topics.push(...draft.overview.topics);
    merged.overview.stated_objectives.push(...draft.overview.stated_objectives);
    merged.overview.suggested_objectives.push(...draft.overview.suggested_objectives);
    merged.overview.explanations.push(...draft.overview.explanations);
    merged.overview.connections.push(...draft.overview.connections);
    merged.overview.unresolved_questions.push(...draft.overview.unresolved_questions);
    merged.tasks.push(...draft.tasks);
    merged.assessments.push(...draft.assessments);
    merged.lab_guides.push(...draft.lab_guides);
    merged.commands_and_code.push(...draft.commands_and_code);
    merged.troubleshooting_entries.push(...draft.troubleshooting_entries);
    merged.glossary.push(...draft.glossary);
    merged.flashcards.push(...draft.flashcards);
    merged.quiz_questions.push(...draft.quiz_questions);
    merged.teacher_questions.push(...draft.teacher_questions);
    merged.conflicts.push(...draft.conflicts);
    merged.review_flags.push(...draft.review_flags);
  }
  return merged;
}

export function isRequirementLevel(value: string): value is RequirementLevel {
  return REQUIREMENT_LEVELS.some((item) => item === value);
}

export function isTaskCategory(value: string): value is TaskCategory {
  return TASK_CATEGORIES.some((item) => item === value);
}

export function isTaskTiming(value: string): value is TaskTiming {
  return TASK_TIMINGS.some((item) => item === value);
}

export function isEvidenceQuality(value: string): value is EvidenceQuality {
  return EVIDENCE_QUALITIES.some((item) => item === value);
}

export function isStudyPack(value: unknown): value is StudyPack {
  if (!value || typeof value !== "object") {
    return false;
  }
  const pack = value as StudyPack;
  return pack.schema_version === SCHEMA_VERSION && Array.isArray(pack.tasks) && pack.overview !== undefined;
}

export function isCompletionStatus(value: string): value is CompletionStatus {
  return value === "todo" || value === "done" || value === "unknown";
}
