const { DateTime, IANAZone } = require("luxon");

const SUPPORTED_PERIODS = new Set(["day", "month", "quarter", "week", "year"]);

function getPeriodDuration(comparisonPeriod) {
  if (comparisonPeriod === "day") return { days: 1 };
  if (comparisonPeriod === "month") return { months: 1 };
  if (comparisonPeriod === "quarter") return { months: 3 };
  if (comparisonPeriod === "week") return { weeks: 1 };
  return { years: 1 };
}

function validateOptions({
  comparison = "previous_period",
  comparisonPeriod,
  periodMode = "completed",
  timezone,
  weekStartsOn,
}) {
  if (!SUPPORTED_PERIODS.has(comparisonPeriod)) {
    throw new Error("Comparison period must be day, week, month, quarter, or year");
  }
  if (comparison !== "previous_period") {
    throw new Error("Comparison must be previous_period");
  }
  if (periodMode !== "completed") {
    throw new Error("Period mode must be completed");
  }
  if (timezone !== "UTC" && !IANAZone.isValidZone(timezone)) {
    throw new Error("Calendar timezone must be a valid IANA timezone");
  }
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 1 || weekStartsOn > 7) {
    throw new Error("Week start must be an integer from 1 to 7");
  }
}

function toDateTime(asOf, timezone) {
  const instant = asOf instanceof Date
    ? DateTime.fromJSDate(asOf, { zone: timezone })
    : DateTime.fromISO(asOf, { zone: timezone });
  if (!instant.isValid) throw new Error("Evaluation time must be a valid date");
  return instant;
}

function getOpenPeriodStart(instant, comparisonPeriod, weekStartsOn) {
  if (comparisonPeriod === "day") return instant.startOf("day");
  if (comparisonPeriod === "month") return instant.startOf("month");
  if (comparisonPeriod === "quarter") return instant.startOf("quarter");
  if (comparisonPeriod === "year") return instant.startOf("year");

  const startOfDay = instant.startOf("day");
  const daysSinceWeekStart = (startOfDay.weekday - weekStartsOn + 7) % 7;
  return startOfDay.minus({ days: daysSinceWeekStart });
}

function getCompletedPeriodWindows({
  asOf = new Date(),
  comparison = "previous_period",
  comparisonPeriod,
  periodMode = "completed",
  timezone = "UTC",
  weekStartsOn = 1,
}) {
  validateOptions({
    comparison,
    comparisonPeriod,
    periodMode,
    timezone,
    weekStartsOn,
  });
  const instant = toDateTime(asOf, timezone);
  const openPeriodStart = getOpenPeriodStart(instant, comparisonPeriod, weekStartsOn);
  const duration = getPeriodDuration(comparisonPeriod);
  const currentPeriodStart = openPeriodStart.minus(duration);
  const comparisonPeriodStart = currentPeriodStart.minus(duration);

  return {
    comparison: {
      end: currentPeriodStart.toJSDate(),
      start: comparisonPeriodStart.toJSDate(),
    },
    comparisonRule: comparison,
    current: {
      end: openPeriodStart.toJSDate(),
      start: currentPeriodStart.toJSDate(),
    },
    period: comparisonPeriod,
    periodMode,
    timezone,
    weekStartsOn: comparisonPeriod === "week" ? weekStartsOn : null,
  };
}

function getPeriodEvaluationSchedule(options) {
  const windows = getCompletedPeriodWindows(options);
  const settlingDelayMinutes = Number(options.settlingDelayMinutes) || 0;
  const duration = getPeriodDuration(windows.period);
  const currentPeriodEnd = DateTime.fromJSDate(windows.current.end, {
    zone: windows.timezone,
  });

  return {
    currentDueAt: currentPeriodEnd.plus({ minutes: settlingDelayMinutes }).toJSDate(),
    nextDueAt: currentPeriodEnd.plus(duration).plus({ minutes: settlingDelayMinutes }).toJSDate(),
    windows,
  };
}

module.exports = {
  getCompletedPeriodWindows,
  getPeriodDuration,
  getPeriodEvaluationSchedule,
};
