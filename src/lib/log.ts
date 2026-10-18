const ALLOWED_KEYS = ["at", "route", "model", "inputTokens", "outputTokens", "userId", "courseId"] as const;

export type ModelUseLog = {
  route: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  userId: string;
  courseId: string;
};

export function logModelUse(event: ModelUseLog): void {
  const payload = {
    at: new Date().toISOString(),
    route: event.route,
    model: event.model,
    inputTokens: event.inputTokens ?? 0,
    outputTokens: event.outputTokens ?? 0,
    userId: event.userId,
    courseId: event.courseId,
  } satisfies Record<(typeof ALLOWED_KEYS)[number], string | number>;

  const safe = Object.fromEntries(ALLOWED_KEYS.map((key) => [key, payload[key]]));
  console.info(JSON.stringify(safe));
}
