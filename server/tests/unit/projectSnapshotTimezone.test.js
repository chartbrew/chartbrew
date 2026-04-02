import {
  describe, expect, it,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  getProjectUpdateTimezone,
  getProjectSnapshotTimezone,
  normalizeProjectScheduleTimezones,
} = require("../../modules/projectSnapshotTimezone.js");

describe("projectSnapshotTimezone", () => {
  it("copies snapshot schedule timezone to the project and removes it from the schedule", () => {
    const normalized = normalizeProjectScheduleTimezones({
      snapshotSchedule: {
        timezone: "Europe/Bucharest",
        frequency: "daily",
      },
    });

    expect(normalized.timezone).toBe("Europe/Bucharest");
    expect(normalized.snapshotSchedule).toEqual({
      frequency: "daily",
    });
  });

  it("copies update schedule timezone to the project and removes it from the schedule", () => {
    const normalized = normalizeProjectScheduleTimezones({
      updateSchedule: {
        timezone: "Europe/Bucharest",
        frequency: "daily",
      },
    });

    expect(normalized.timezone).toBe("Europe/Bucharest");
    expect(normalized.updateSchedule).toEqual({
      frequency: "daily",
    });
  });

  it("keeps the existing project timezone when normalizing schedules", () => {
    const normalized = normalizeProjectScheduleTimezones({
      timezone: "America/New_York",
      updateSchedule: {
        timezone: "Europe/Bucharest",
        frequency: "daily",
      },
      snapshotSchedule: {
        timezone: "Europe/London",
        frequency: "weekly",
      },
    });

    expect(normalized.timezone).toBe("America/New_York");
    expect(normalized.updateSchedule).toEqual({
      frequency: "daily",
    });
    expect(normalized.snapshotSchedule).toEqual({
      frequency: "weekly",
    });
  });

  it("resolves the snapshot cron timezone from the project first, then legacy schedule data", () => {
    expect(getProjectSnapshotTimezone({
      timezone: "America/Los_Angeles",
      snapshotSchedule: { timezone: "Europe/Bucharest" },
    })).toBe("America/Los_Angeles");

    expect(getProjectSnapshotTimezone({
      snapshotSchedule: { timezone: "Europe/Bucharest" },
    })).toBe("Europe/Bucharest");

    expect(getProjectSnapshotTimezone({
      snapshotSchedule: {},
    })).toBe("UTC");
  });

  it("resolves the update cron timezone from the project first, then legacy schedule data", () => {
    expect(getProjectUpdateTimezone({
      timezone: "America/Los_Angeles",
      updateSchedule: { timezone: "Europe/Bucharest" },
    })).toBe("America/Los_Angeles");

    expect(getProjectUpdateTimezone({
      updateSchedule: { timezone: "Europe/Bucharest" },
    })).toBe("Europe/Bucharest");

    expect(getProjectUpdateTimezone({
      updateSchedule: {},
    })).toBe("UTC");
  });
});
