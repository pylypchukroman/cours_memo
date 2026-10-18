export const ITEM_TYPES = ["concept", "task", "assessment", "promise", "correction"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["active", "superseded", "cancelled"] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export type MemoryEvent = {
  itemType: ItemType;
  title: string;
  summary: string;
};

export type ActiveMemoryItem = {
  id: string;
  itemType: ItemType;
  title: string;
  summary: string;
  status: ItemStatus;
};

export type ReconcileAction = {
  action: "add" | "supersede" | "cancel";
  eventIndex: number;
  targetItemId: string | null;
};

export function isItemType(value: string): value is ItemType {
  return ITEM_TYPES.some((itemType) => itemType === value);
}

export function isItemStatus(value: string): value is ItemStatus {
  return ITEM_STATUSES.some((status) => status === value);
}
