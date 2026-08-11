const { resolveChartConfiguredDateRange } = require("../chartRuntimeFilters");
const { getCompletedPeriodWindows } = require("./periodWindows");

const COMPARISON_PERIODS = ["day", "week", "month", "quarter", "year"];

const PERIOD_NAMES = {
  day: "days",
  month: "months",
  quarter: "quarters",
  week: "weeks",
  year: "years",
};

function toValidDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getStoredTimeRange(chart = {}) {
  const timeRange = chart.chartData?.meta?.timeRange;
  const start = toValidDate(timeRange?.start);
  const end = toValidDate(timeRange?.end);
  if (!start || !end || start >= end) return null;
  return { end, start };
}

function getConfiguredTimeRange(chart = {}, timezone = "UTC") {
  const range = resolveChartConfiguredDateRange(chart, timezone);
  if (!range?.startDate || !range?.endDate) return null;

  const start = toValidDate(range.startDate);
  const inclusiveEnd = toValidDate(range.endDate);
  if (!start || !inclusiveEnd || start > inclusiveEnd) return null;

  return {
    end: new Date(inclusiveEnd.getTime() + 1),
    start,
  };
}

function getChartTimeRange(chart = {}, timezone = "UTC") {
  return getStoredTimeRange(chart) || getConfiguredTimeRange(chart, timezone);
}

function getUnavailableReason(period) {
  return `Needs the last two complete ${PERIOD_NAMES[period]} in this chart`;
}

function getPeriodAvailability(chart, {
  asOf = new Date(),
  timezone = "UTC",
  weekStartsOn = 1,
} = {}) {
  const range = getChartTimeRange(chart, timezone);

  return COMPARISON_PERIODS.reduce((availability, period) => {
    if (!range) {
      availability[period] = { available: true, known: false, reason: null };
      return availability;
    }

    const windows = getCompletedPeriodWindows({
      asOf,
      comparisonPeriod: period,
      timezone,
      weekStartsOn,
    });
    const available = range.start <= windows.comparison.start
      && range.end >= windows.current.end;
    availability[period] = {
      available,
      known: true,
      reason: available ? null : getUnavailableReason(period),
    };
    return availability;
  }, {});
}

function assertPeriodAvailable(chart, options = {}) {
  const period = options.comparisonPeriod;
  const result = getPeriodAvailability(chart, options)[period];
  if (result?.available === false) {
    const error = new Error(result.reason);
    error.code = "comparison_history_insufficient";
    throw error;
  }
}

module.exports = {
  COMPARISON_PERIODS,
  assertPeriodAvailable,
  getChartTimeRange,
  getPeriodAvailability,
  getUnavailableReason,
};
