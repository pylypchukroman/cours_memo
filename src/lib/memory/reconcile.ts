import type { ActiveMemoryItem, MemoryEvent, ReconcileAction } from "@/lib/memory/types";

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

const CANCEL_PATTERN = /скасован|cancelled|cancel|більше не/i;

export function planReconcile(events: MemoryEvent[], items: ActiveMemoryItem[]): ReconcileAction[] {
  return events.map((event, eventIndex) => {
    const title = normalize(event.title);
    const match = items.find(
      (item) =>
        item.status === "active" &&
        item.itemType === event.itemType &&
        normalize(item.title) === title,
    );

    if (match && CANCEL_PATTERN.test(event.summary)) {
      return { action: "cancel", eventIndex, targetItemId: match.id };
    }

    if (match) {
      return { action: "supersede", eventIndex, targetItemId: match.id };
    }

    return { action: "add", eventIndex, targetItemId: null };
  });
}

export function sanitizeReconcileActions(
  proposed: ReconcileAction[],
  events: MemoryEvent[],
  items: ActiveMemoryItem[],
): ReconcileAction[] {
  const activeIds = new Set(items.filter((item) => item.status === "active").map((item) => item.id));

  return events.map((event, eventIndex) => {
    const proposal = proposed.find((action) => action.eventIndex === eventIndex);
    if (!proposal) {
      return planReconcile([event], items)[0];
    }

    if (proposal.action === "add") {
      return { action: "add", eventIndex, targetItemId: null };
    }

    if (proposal.targetItemId && activeIds.has(proposal.targetItemId)) {
      return {
        action: proposal.action,
        eventIndex,
        targetItemId: proposal.targetItemId,
      };
    }

    return planReconcile([event], items)[0];
  });
}
