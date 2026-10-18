import { isItemStatus, isItemType, type ItemStatus, type ItemType } from "@/lib/memory/types";

export type QueryPlan =
  | { mode: "retrieval" }
  | { mode: "memory"; itemTypes: ItemType[]; statuses: ItemStatus[] };

const TYPE_PATTERNS: Array<{ type: ItemType; pattern: RegExp }> = [
  { type: "task", pattern: /завдан|домашк|homework|\btasks?\b/i },
  { type: "assessment", pattern: /іспит|екзамен|залік|тест|assessment|quiz|exam/i },
  { type: "promise", pattern: /обіця|promise/i },
  { type: "correction", pattern: /виправл|скасув|correction/i },
  { type: "concept", pattern: /понят|концепц|термін|concept/i },
];

const MEMORY_INTENT = /як[аіий]|список|перелік|що\s+(залиши|було|є)|what|list|which/i;
const RETRIEVAL_INTENT = /хвилин|таймкод|урок|казав|казали|сказано|when|minute|timestamp/i;

export function classifyByKeywords(question: string): QueryPlan {
  const itemTypes = TYPE_PATTERNS.filter(({ pattern }) => pattern.test(question)).map(
    ({ type }) => type,
  );

  if (itemTypes.length > 0 && MEMORY_INTENT.test(question) && !RETRIEVAL_INTENT.test(question)) {
    return { mode: "memory", itemTypes, statuses: ["active"] };
  }

  return { mode: "retrieval" };
}

export function parseQueryPlan(value: unknown): QueryPlan | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as { mode?: unknown; item_types?: unknown; statuses?: unknown };
  if (record.mode === "retrieval") {
    return { mode: "retrieval" };
  }

  if (record.mode !== "memory" || !Array.isArray(record.item_types)) {
    return null;
  }

  const itemTypes = record.item_types.filter((item): item is ItemType => typeof item === "string" && isItemType(item));
  if (itemTypes.length === 0) {
    return { mode: "retrieval" };
  }

  const statuses = Array.isArray(record.statuses)
    ? record.statuses.filter((status): status is ItemStatus => typeof status === "string" && isItemStatus(status))
    : [];

  return {
    mode: "memory",
    itemTypes,
    statuses: statuses.length > 0 ? statuses : ["active"],
  };
}
