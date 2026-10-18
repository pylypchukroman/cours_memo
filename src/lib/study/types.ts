export const SCHEMA_VERSION = "1.0";
export const PROMPT_VERSION = "study-pack-1";

export const ORIGINS = ["explicit", "inferred", "generated"] as const;
export const EVIDENCE_QUALITIES = ["clear", "ambiguous", "conflicting"] as const;
export const REVIEW_STATUSES = ["pending", "confirmed", "corrected", "dismissed"] as const;
export const COMPLETION_STATUSES = ["todo", "done", "unknown"] as const;
export const TASK_CATEGORIES = [
  "homework",
  "assessment",
  "lab",
  "reading",
  "install",
  "preparation",
  "other",
] as const;
export const REQUIREMENT_LEVELS = ["required", "optional", "suggestion"] as const;
export const TASK_TIMINGS = ["during_lesson", "assigned_later", "unknown"] as const;
export const EXTRACTED_COMPLETIONS = ["todo", "done_in_class", "unknown"] as const;

export type Origin = (typeof ORIGINS)[number];
export type EvidenceQuality = (typeof EVIDENCE_QUALITIES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];
export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export type RequirementLevel = (typeof REQUIREMENT_LEVELS)[number];
export type TaskTiming = (typeof TASK_TIMINGS)[number];

export type SourceRef = {
  lesson_id: string;
  segment_id: string;
  start_ms: number | null;
  end_ms: number | null;
  quote: string;
};

export type Due = {
  date: string | null;
  datetime: null;
  timezone: string;
  original_text: string | null;
  resolution_note: string | null;
};

export type SourcedNote = {
  text: string;
  origin: Origin;
  sources: SourceRef[];
};

export type StudyTask = {
  id: string;
  item_key: string;
  title: string;
  description: string;
  category: TaskCategory;
  requirement_level: RequirementLevel;
  timing: TaskTiming;
  origin: Origin;
  evidence_quality: EvidenceQuality;
  due: Due;
  extracted_completion: (typeof EXTRACTED_COMPLETIONS)[number];
  completion_status: CompletionStatus;
  review_status: ReviewStatus;
  dependencies: Array<{ title: string; origin: Origin }>;
  sources: SourceRef[];
  review_flags: string[];
};

export type ChecklistItem = {
  item_key: string;
  label: string;
  kind: "submit" | "file" | "evidence" | "demo" | "criterion";
};

export type StudyAssessment = {
  id: string;
  item_key: string;
  title: string;
  must_submit: string[];
  submission_format: string | null;
  submission_location: string | null;
  due: Due;
  required_files: string[];
  required_evidence: string[];
  demonstrations: string[];
  marking_criteria: string[];
  teacher_clarifications: string[];
  common_mistakes: string[];
  tools: string[];
  origin: Origin;
  evidence_quality: EvidenceQuality;
  checklist: ChecklistItem[];
  conflicts: Array<{ description: string; sources: SourceRef[] }>;
  sources: SourceRef[];
  review_flags: string[];
};

export type LabGuide = {
  id: string;
  item_key: string;
  title: string;
  objective: string;
  prerequisites: string[];
  tools: string[];
  steps: Array<{ text: string; origin: "explicit" | "generated" }>;
  expected_results: string[];
  verification: string[];
  troubleshooting: string[];
  evidence_to_save: string[];
  cleanup: string[];
  incomplete: boolean;
  missing_information: string[];
  sources: SourceRef[];
};

export type CommandEntry = {
  id: string;
  item_key: string;
  source_text: string;
  language: string | null;
  purpose: string;
  placeholders: string[];
  expected_result: string | null;
  proposed_correction: string | null;
  caution: string | null;
  sources: SourceRef[];
  review_flags: string[];
};

export type TroubleshootingEntry = {
  id: string;
  item_key: string;
  symptoms: string;
  environment: string | null;
  causes: string[];
  diagnostic_steps: string[];
  attempted_fixes: string[];
  confirmed_resolution: string | null;
  prevention: string | null;
  sources: SourceRef[];
};

export type GlossaryEntry = {
  id: string;
  item_key: string;
  term: string;
  acronym_expansion: string | null;
  explanation: string;
  example: string | null;
  related_terms: string[];
  origin: Origin;
  sources: SourceRef[];
};

export type Flashcard = {
  id: string;
  item_key: string;
  front: string;
  back: string;
  explanation: string;
  extension: boolean;
  sources: SourceRef[];
};

export type QuizQuestion = {
  id: string;
  item_key: string;
  prompt: string;
  kind: "multiple_choice" | "short_answer" | "scenario";
  choices: string[];
  answer: string;
  explanation: string;
  extension: boolean;
  sources: SourceRef[];
};

export type TeacherQuestion = {
  id: string;
  item_key: string;
  text: string;
  reason: string;
  origin: "explicit" | "generated";
  sources: SourceRef[];
};

export type StudyConflict = {
  description: string;
  sources: SourceRef[];
};

export type StudyPack = {
  schema_version: typeof SCHEMA_VERSION;
  lesson_id: string;
  processing_status: "completed" | "partial";
  overview: {
    summary: string | null;
    topics: string[];
    stated_objectives: SourcedNote[];
    suggested_objectives: SourcedNote[];
    explanations: SourcedNote[];
    connections: SourcedNote[];
    unresolved_questions: SourcedNote[];
  };
  tasks: StudyTask[];
  assessments: StudyAssessment[];
  lab_guides: LabGuide[];
  commands_and_code: CommandEntry[];
  troubleshooting_entries: TroubleshootingEntry[];
  glossary: GlossaryEntry[];
  flashcards: Flashcard[];
  quiz_questions: QuizQuestion[];
  teacher_questions: TeacherQuestion[];
  cross_lesson_connections: SourcedNote[];
  conflicts: StudyConflict[];
  review_flags: string[];
  processing_warnings: string[];
};

export type DraftSource = {
  segment_ordinal: number;
  quote: string;
};

export type StudyDraft = {
  overview: {
    summary: string;
    summary_sources: DraftSource[];
    topics: string[];
    stated_objectives: Array<{ text: string; sources: DraftSource[] }>;
    suggested_objectives: Array<{ text: string; sources: DraftSource[] }>;
    explanations: Array<{ text: string; sources: DraftSource[] }>;
    connections: Array<{ text: string; sources: DraftSource[] }>;
    unresolved_questions: Array<{ text: string; sources: DraftSource[] }>;
  };
  tasks: Array<{
    title: string;
    description: string;
    category: string;
    requirement_level: string;
    timing: string;
    origin: string;
    evidence_quality: string;
    due_text: string | null;
    extracted_completion: string;
    dependency_titles: string[];
    sources: DraftSource[];
    review_flags: string[];
  }>;
  assessments: Array<{
    title: string;
    must_submit: string[];
    submission_format: string | null;
    submission_location: string | null;
    due_text: string | null;
    required_files: string[];
    required_evidence: string[];
    demonstrations: string[];
    marking_criteria: string[];
    teacher_clarifications: string[];
    common_mistakes: string[];
    tools: string[];
    origin: string;
    evidence_quality: string;
    conflicts: Array<{ description: string; sources: DraftSource[] }>;
    sources: DraftSource[];
    review_flags: string[];
  }>;
  lab_guides: Array<{
    title: string;
    objective: string;
    prerequisites: string[];
    tools: string[];
    steps: Array<{ text: string; origin: string }>;
    expected_results: string[];
    verification: string[];
    troubleshooting: string[];
    evidence_to_save: string[];
    cleanup: string[];
    incomplete: boolean;
    missing_information: string[];
    sources: DraftSource[];
  }>;
  commands_and_code: Array<{
    source_text: string;
    language: string | null;
    purpose: string;
    placeholders: string[];
    expected_result: string | null;
    proposed_correction: string | null;
    sources: DraftSource[];
    review_flags: string[];
  }>;
  troubleshooting_entries: Array<{
    symptoms: string;
    environment: string | null;
    causes: string[];
    diagnostic_steps: string[];
    attempted_fixes: string[];
    confirmed_resolution: string | null;
    prevention: string | null;
    sources: DraftSource[];
  }>;
  glossary: Array<{
    term: string;
    acronym_expansion: string | null;
    explanation: string;
    example: string | null;
    related_terms: string[];
    origin: string;
    sources: DraftSource[];
  }>;
  flashcards: Array<{
    front: string;
    back: string;
    explanation: string;
    extension: boolean;
    sources: DraftSource[];
  }>;
  quiz_questions: Array<{
    prompt: string;
    kind: string;
    choices: string[];
    answer: string;
    explanation: string;
    extension: boolean;
    sources: DraftSource[];
  }>;
  teacher_questions: Array<{
    text: string;
    reason: string;
    origin: string;
    sources: DraftSource[];
  }>;
  conflicts: Array<{ description: string; sources: DraftSource[] }>;
  review_flags: string[];
};

export type StudySegment = {
  id: string;
  ordinal: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
};

export type StudyContext = {
  lessonId: string;
  timezone: string;
  lessonDate: string | null;
  segments: StudySegment[];
};

export type ItemState = {
  completionStatus: CompletionStatus;
  reviewStatus: ReviewStatus;
  note: string | null;
};
