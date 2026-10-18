import { describe, expect, it } from "vitest";

import { planReconcile, sanitizeReconcileActions } from "@/lib/memory/reconcile";
import type { ActiveMemoryItem, MemoryEvent } from "@/lib/memory/types";

const existing: ActiveMemoryItem[] = [
  {
    id: "item-1",
    itemType: "task",
    title: "Довести правило добутку",
    summary: "Здати до п'ятниці",
    status: "active",
  },
];

describe("planReconcile", () => {
  it("adds a new topic, supersedes the same title, and cancels when the summary says so", () => {
    const events: MemoryEvent[] = [
      { itemType: "concept", title: "Похідна", summary: "Швидкість зміни" },
      { itemType: "task", title: "Довести правило добутку", summary: "Термін перенесено на понеділок" },
      { itemType: "task", title: "Довести правило добутку", summary: "Завдання скасовано" },
    ];

    expect(planReconcile(events, existing)).toEqual([
      { action: "add", eventIndex: 0, targetItemId: null },
      { action: "supersede", eventIndex: 1, targetItemId: "item-1" },
      { action: "cancel", eventIndex: 2, targetItemId: "item-1" },
    ]);
  });

  it("rejects a supersede aimed at an unknown item", () => {
    const events: MemoryEvent[] = [{ itemType: "task", title: "Нове", summary: "Опис" }];
    const sanitized = sanitizeReconcileActions(
      [{ action: "supersede", eventIndex: 0, targetItemId: "missing" }],
      events,
      existing,
    );

    expect(sanitized).toEqual([{ action: "add", eventIndex: 0, targetItemId: null }]);
  });
});
