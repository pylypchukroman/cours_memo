import type { ItemStatus, ItemType } from "@/lib/memory/types";

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  concept: "Concept",
  task: "Task",
  assessment: "Assessment",
  promise: "Promise",
  correction: "Correction",
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  active: "Active",
  superseded: "Superseded",
  cancelled: "Cancelled",
};

export const VERSION_ACTION_LABELS = {
  add: "Added",
  supersede: "Superseded",
  cancel: "Cancelled",
} as const;
