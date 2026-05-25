import {
  describe, expect, it,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  getWeekdayNumber,
  shouldRunOnWeekday,
} = require("../../modules/scheduleWeekdays.js");

describe("scheduleWeekdays", () => {
  it("maps weekday names and numbers to Luxon weekday numbers", () => {
    expect(getWeekdayNumber("monday")).toBe(1);
    expect(getWeekdayNumber("SUNDAY")).toBe(7);
    expect(getWeekdayNumber(5)).toBe(5);
    expect(getWeekdayNumber("noday")).toBeUndefined();
  });

  it("allows every day when daily schedule days are not configured", () => {
    expect(shouldRunOnWeekday(undefined, { weekday: 3 })).toBe(true);
    expect(shouldRunOnWeekday(null, { weekday: 3 })).toBe(true);
  });

  it("matches configured daily schedule days", () => {
    const daysOfWeek = ["monday", "wednesday", 5];

    expect(shouldRunOnWeekday(daysOfWeek, { weekday: 1 })).toBe(true);
    expect(shouldRunOnWeekday(daysOfWeek, { weekday: 3 })).toBe(true);
    expect(shouldRunOnWeekday(daysOfWeek, { weekday: 5 })).toBe(true);
    expect(shouldRunOnWeekday(daysOfWeek, { weekday: 7 })).toBe(false);
  });

  it("does not run when a configured daily schedule has no selected days", () => {
    expect(shouldRunOnWeekday([], { weekday: 3 })).toBe(false);
  });
});
