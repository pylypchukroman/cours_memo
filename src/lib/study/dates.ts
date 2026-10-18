import type { Due } from "@/lib/study/types";

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function normalizeTimezone(value: string | null | undefined): string {
  const fallback = "Australia/Sydney";
  const trimmed = value?.trim() || fallback;
  if (trimmed.length > 64) {
    return fallback;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return fallback;
  }
}

export function resolveDue(
  originalText: string | null,
  lessonDate: string | null,
  timezone: string,
): Due {
  const original = originalText?.replace(/\s+/g, " ").trim() || null;
  const empty: Due = {
    date: null,
    datetime: null,
    timezone,
    original_text: original,
    resolution_note: null,
  };
  if (!original) {
    return { ...empty, original_text: null };
  }

  const iso = original.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const date = isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (date) {
      return {
        date,
        datetime: null,
        timezone,
        original_text: original,
        resolution_note: "The transcript states this calendar date.",
      };
    }
  }

  const named = original.match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
  );
  if (named) {
    const date = isoDate(Number(named[3]), MONTHS.indexOf(named[2].toLowerCase()) + 1, Number(named[1]));
    if (date) {
      return {
        date,
        datetime: null,
        timezone,
        original_text: original,
        resolution_note: "The transcript states this calendar date.",
      };
    }
  }

  if (lessonDate && /^\d{4}-\d{2}-\d{2}$/.test(lessonDate)) {
    const mentionsToday = /\btoday\b/i.test(original);
    const mentionsTomorrow = /\btomorrow\b/i.test(original);
    if (mentionsToday !== mentionsTomorrow) {
      return {
        date: mentionsTomorrow ? addDays(lessonDate, 1) : lessonDate,
        datetime: null,
        timezone,
        original_text: original,
        resolution_note: mentionsTomorrow
          ? "Resolved from “tomorrow” using the lesson date. No time of day was stated."
          : "Resolved from “today” using the lesson date. No time of day was stated.",
      };
    }
  }

  return empty;
}
