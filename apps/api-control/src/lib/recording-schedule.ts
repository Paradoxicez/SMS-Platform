/**
 * Recording schedule utilities — determines whether recording should be active
 * based on configured time windows.
 */

export interface ScheduleWindow {
  /** Days of week: "mon","tue","wed","thu","fri","sat","sun" */
  days: string[];
  /** Start time in HH:MM (24h) */
  from: string;
  /** End time in HH:MM (24h). If from > to, wraps past midnight. */
  to: string;
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Check if the current time falls within any of the schedule windows.
 * Returns true if recording should be active now.
 *
 * If schedule is null/empty, returns true (always active = continuous).
 */
export function isWithinSchedule(
  schedule: ScheduleWindow[] | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!schedule || schedule.length === 0) return true;

  const dayName = DAY_NAMES[now.getDay()]!;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const window of schedule) {
    // Check if today is in the window's days
    if (!window.days.includes(dayName)) continue;

    const fromMinutes = parseTime(window.from);
    const toMinutes = parseTime(window.to);

    if (fromMinutes <= toMinutes) {
      // Same-day window: e.g., 09:00-17:00
      if (currentMinutes >= fromMinutes && currentMinutes < toMinutes) {
        return true;
      }
    } else {
      // Overnight window: e.g., 18:00-06:00
      if (currentMinutes >= fromMinutes || currentMinutes < toMinutes) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get the next time recording will start, based on schedule.
 * Returns null if always active or no upcoming window.
 */
export function getNextScheduleStart(
  schedule: ScheduleWindow[] | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (!schedule || schedule.length === 0) return null;

  // Check next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    const dayName = DAY_NAMES[checkDate.getDay()]!;

    for (const window of schedule) {
      if (!window.days.includes(dayName)) continue;

      const fromMinutes = parseTime(window.from);
      const startDate = new Date(checkDate);
      startDate.setHours(Math.floor(fromMinutes / 60), fromMinutes % 60, 0, 0);

      if (startDate > now) {
        return startDate;
      }
    }
  }

  return null;
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}
