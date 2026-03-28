import { describe, it, expect } from "vitest";
import { isWithinSchedule, getNextScheduleStart, type ScheduleWindow } from "../recording-schedule";

describe("recording-schedule", () => {
  describe("isWithinSchedule", () => {
    it("should return true when schedule is null (continuous mode)", () => {
      expect(isWithinSchedule(null)).toBe(true);
      expect(isWithinSchedule(undefined)).toBe(true);
      expect(isWithinSchedule([])).toBe(true);
    });

    it("should return true when within a same-day window", () => {
      const schedule: ScheduleWindow[] = [
        { days: ["mon", "tue", "wed", "thu", "fri"], from: "09:00", to: "17:00" },
      ];
      // Wednesday 12:00
      const now = new Date("2026-03-25T12:00:00");
      expect(isWithinSchedule(schedule, now)).toBe(true);
    });

    it("should return false when outside a same-day window", () => {
      const schedule: ScheduleWindow[] = [
        { days: ["mon", "tue", "wed", "thu", "fri"], from: "09:00", to: "17:00" },
      ];
      // Wednesday 20:00
      const now = new Date("2026-03-25T20:00:00");
      expect(isWithinSchedule(schedule, now)).toBe(false);
    });

    it("should return false when on wrong day", () => {
      const schedule: ScheduleWindow[] = [
        { days: ["mon", "tue", "wed", "thu", "fri"], from: "09:00", to: "17:00" },
      ];
      // Saturday 12:00
      const now = new Date("2026-03-28T12:00:00");
      expect(isWithinSchedule(schedule, now)).toBe(false);
    });

    it("should handle overnight window (18:00 to 06:00)", () => {
      const schedule: ScheduleWindow[] = [
        { days: ["mon", "tue", "wed", "thu", "fri"], from: "18:00", to: "06:00" },
      ];
      // Wednesday 22:00 — should be within
      expect(isWithinSchedule(schedule, new Date("2026-03-25T22:00:00"))).toBe(true);
      // Wednesday 03:00 — should be within (before 06:00)
      expect(isWithinSchedule(schedule, new Date("2026-03-25T03:00:00"))).toBe(true);
      // Wednesday 12:00 — should be outside
      expect(isWithinSchedule(schedule, new Date("2026-03-25T12:00:00"))).toBe(false);
    });

    it("should handle multiple windows", () => {
      const schedule: ScheduleWindow[] = [
        { days: ["mon", "wed", "fri"], from: "08:00", to: "12:00" },
        { days: ["tue", "thu"], from: "14:00", to: "18:00" },
      ];
      // Monday 10:00 — in first window
      expect(isWithinSchedule(schedule, new Date("2026-03-23T10:00:00"))).toBe(true);
      // Tuesday 16:00 — in second window
      expect(isWithinSchedule(schedule, new Date("2026-03-24T16:00:00"))).toBe(true);
      // Monday 14:00 — not in any window
      expect(isWithinSchedule(schedule, new Date("2026-03-23T14:00:00"))).toBe(false);
    });

    it("should handle weekend-only schedule", () => {
      const schedule: ScheduleWindow[] = [
        { days: ["sat", "sun"], from: "00:00", to: "23:59" },
      ];
      // Saturday 15:00
      expect(isWithinSchedule(schedule, new Date("2026-03-28T15:00:00"))).toBe(true);
      // Wednesday 15:00
      expect(isWithinSchedule(schedule, new Date("2026-03-25T15:00:00"))).toBe(false);
    });
  });

  describe("getNextScheduleStart", () => {
    it("should return null for continuous mode", () => {
      expect(getNextScheduleStart(null)).toBeNull();
      expect(getNextScheduleStart([])).toBeNull();
    });

    it("should find next start time on same day", () => {
      const schedule: ScheduleWindow[] = [
        { days: ["wed"], from: "18:00", to: "23:00" },
      ];
      // Wednesday 10:00 — next start is 18:00 same day
      const now = new Date("2026-03-25T10:00:00");
      const next = getNextScheduleStart(schedule, now);
      expect(next).not.toBeNull();
      expect(next!.getHours()).toBe(18);
      expect(next!.getMinutes()).toBe(0);
    });

    it("should find next start on future day", () => {
      const schedule: ScheduleWindow[] = [
        { days: ["fri"], from: "09:00", to: "17:00" },
      ];
      // Wednesday 20:00 — next start is Friday 09:00
      const now = new Date("2026-03-25T20:00:00");
      const next = getNextScheduleStart(schedule, now);
      expect(next).not.toBeNull();
      expect(next!.getDay()).toBe(5); // Friday
      expect(next!.getHours()).toBe(9);
    });
  });
});
