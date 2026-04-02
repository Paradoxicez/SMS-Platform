/**
 * Shared date formatters for consistent display across all tables.
 *
 * Supports user preferences: date_format (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY),
 * time_format (24h, 12h), and timezone.
 */

export type DateFormatPref = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";
export type TimeFormatPref = "24h" | "12h";

export interface DatePrefs {
  dateFormat?: DateFormatPref;
  timeFormat?: TimeFormatPref;
  timezone?: string;
}

// Module-level defaults — updated by DatePrefsProvider
let _prefs: DatePrefs = {};

/** Called by DatePrefsProvider to set global preferences */
export function setDatePrefs(prefs: DatePrefs) {
  _prefs = prefs;
}

function formatDateParts(d: Date, fmt: DateFormatPref, tz?: string): string {
  // Use Intl to extract parts in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(tz ? { timeZone: tz } : {}),
  }).formatToParts(d);

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";

  switch (fmt) {
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

function formatTimeParts(d: Date, fmt: TimeFormatPref, tz?: string): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: fmt === "12h",
    ...(tz ? { timeZone: tz } : {}),
  });
}

/** Format date only — e.g. "2026-04-02", "02/04/2026", "04/02/2026" */
export function formatDate(
  dateStr: string | null | undefined,
  prefs?: DatePrefs,
): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const p = prefs ?? _prefs;
  return formatDateParts(d, p.dateFormat ?? "YYYY-MM-DD", p.timezone);
}

/** Format date + time — e.g. "2026-04-02 14:20" */
export function formatDateTime(
  dateStr: string | null | undefined,
  prefs?: DatePrefs,
): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const p = prefs ?? _prefs;
  const datePart = formatDateParts(d, p.dateFormat ?? "YYYY-MM-DD", p.timezone);
  const timePart = formatTimeParts(d, p.timeFormat ?? "24h", p.timezone);
  return `${datePart} ${timePart}`;
}

/** Format time only — e.g. "14:20" or "2:20 PM" */
export function formatTime(
  dateStr: string | null | undefined,
  prefs?: DatePrefs,
): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  const p = prefs ?? _prefs;
  return formatTimeParts(d, p.timeFormat ?? "24h", p.timezone);
}
