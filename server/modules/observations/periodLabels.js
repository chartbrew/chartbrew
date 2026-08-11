const { DateTime } = require("luxon");

function localDate(value, timezone) {
  return DateTime.fromJSDate(new Date(value), { zone: "utc" }).setZone(timezone || "UTC");
}

function formatWeekLabel(start, end, timezone) {
  const first = localDate(start, timezone);
  const last = localDate(end, timezone).minus({ milliseconds: 1 });
  if (first.year !== last.year) {
    return `${first.toFormat("LLLL d, yyyy")}–${last.toFormat("LLLL d, yyyy")}`;
  }
  if (first.month !== last.month) {
    return `${first.toFormat("LLLL d")}–${last.toFormat("LLLL d, yyyy")}`;
  }
  return `${first.toFormat("LLLL d")}–${last.toFormat("d, yyyy")}`;
}

function formatPeriodLabel(period, window, timezone = "UTC") {
  if (!window?.start || !window?.end) return "Unknown period";
  const start = localDate(window.start, timezone);
  if (period === "day") return start.toFormat("LLLL d, yyyy");
  if (period === "month") return start.toFormat("LLLL yyyy");
  if (period === "quarter") return `Q${start.quarter} ${start.year}`;
  if (period === "week") return formatWeekLabel(window.start, window.end, timezone);
  if (period === "year") return start.toFormat("yyyy");
  return start.toFormat("LLLL d, yyyy");
}

function formatComparisonLabel({ comparison, current, period, timezone }) {
  return `${formatPeriodLabel(period, current, timezone)} compared with ${
    formatPeriodLabel(period, comparison, timezone)
  }`;
}

module.exports = {
  formatComparisonLabel,
  formatPeriodLabel,
  formatWeekLabel,
};
