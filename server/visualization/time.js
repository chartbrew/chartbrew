const moment = require("moment-timezone");

const SUPPORTED_TIME_UNITS = new Set([
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",
]);

function createMoment(value, timezone, formatHint) {
  if (value === null || value === undefined || value === "") return null;

  let parsed;
  const stringValue = `${value}`;
  if (/^\d{10}$/.test(stringValue)) {
    parsed = moment.unix(Number(stringValue)).utc();
  } else if (/^\d{13}$/.test(stringValue)) {
    parsed = moment.utc(Number(stringValue));
  } else if (formatHint) {
    parsed = moment.utc(value, formatHint, true);
  } else {
    parsed = moment.utc(value);
  }

  if (!parsed.isValid()) return null;
  return timezone ? parsed.tz(timezone) : parsed;
}

function bucketTime(value, unit = "day", timezone, formatHint) {
  const normalizedUnit = SUPPORTED_TIME_UNITS.has(unit) ? unit : "day";
  const parsed = createMoment(value, timezone, formatHint);
  if (!parsed) return null;

  if (normalizedUnit === "week") parsed.startOf("isoWeek");
  else parsed.startOf(normalizedUnit);

  return parsed.valueOf();
}

function getTimeLabelFormat(values, unit, timezone) {
  const parsedValues = values
    .map((value) => createMoment(value, timezone))
    .filter(Boolean)
    .sort((left, right) => left.valueOf() - right.valueOf());
  if (parsedValues.length === 0) return "YYYY MMM D";

  const start = parsedValues[0];
  const end = parsedValues[parsedValues.length - 1];
  const now = timezone ? moment().tz(timezone) : moment.utc();

  switch (unit) {
    case "second":
      if (start.year() !== end.year()) return "YYYY/MM/DD HH:mm:ss";
      if (start.month() !== end.month()) return "MMM Do HH:mm:ss";
      if (start.isoWeek() !== end.isoWeek()) return "ddd Do HH:mm:ss";
      if (start.day() !== end.day()) return "ddd HH:mm:ss";
      if (start.day() === end.day() && now.day() === start.day()) return "HH:mm:ss";
      return "MMM Do HH:mm:ss";
    case "minute":
      if (start.year() !== end.year()) return "YYYY/MM/DD HH:mm";
      if (start.month() !== end.month()) return "MMM Do HH:mm";
      if (start.isoWeek() !== end.isoWeek()) return "ddd Do HH:mm";
      if (start.day() !== end.day()) return "ddd HH:mm";
      if (start.day() === end.day() && now.day() === start.day()) return "HH:mm";
      return "MMM Do HH:mm";
    case "hour":
      if (start.year() !== end.year()) return "YYYY/MM/DD hA";
      if (start.month() !== end.month()) return "MMM Do hA";
      return "ddd Do hA";
    case "week":
      return "GGGG [W] WW";
    case "month":
      return start.year() !== end.year() || now.year() !== start.year() ? "MMM YYYY" : "MMM";
    case "year":
      return "YYYY";
    case "day":
    default:
      return start.year() !== end.year() || now.year() !== start.year() ? "YYYY MMM D" : "MMM D";
  }
}

function formatTimeValues(values, unit = "day", timezone) {
  const format = getTimeLabelFormat(values, unit, timezone);
  return {
    format,
    labels: values.map((value) => {
      const parsed = createMoment(value, timezone);
      return parsed ? parsed.format(format) : value;
    }),
  };
}

function expandTimeValues(values, unit = "day", timezone, range = {}, limit = 10000) {
  const normalizedUnit = SUPPORTED_TIME_UNITS.has(unit) ? unit : "day";
  const numericValues = values
    .map((value) => bucketTime(value, normalizedUnit, timezone))
    .filter((value) => value !== null)
    .sort((left, right) => left - right);
  const uniqueValues = [...new Set(numericValues)];
  const rangeStart = bucketTime(range.startDate, normalizedUnit, timezone);
  const rangeEnd = bucketTime(range.endDate, normalizedUnit, timezone);
  const start = rangeStart ?? uniqueValues[0] ?? null;
  const end = rangeEnd ?? uniqueValues[uniqueValues.length - 1] ?? null;

  if (start === null || end === null || start > end) return uniqueValues;

  const expanded = [];
  const current = createMoment(start, timezone);
  const final = createMoment(end, timezone);
  while (current && final && current.isSameOrBefore(final) && expanded.length < limit) {
    expanded.push(current.valueOf());
    current.add(1, normalizedUnit);
    if (normalizedUnit === "week") current.startOf("isoWeek");
    else current.startOf(normalizedUnit);
  }

  return current && final && current.isSameOrBefore(final) ? uniqueValues : expanded;
}

module.exports = {
  SUPPORTED_TIME_UNITS,
  bucketTime,
  createMoment,
  expandTimeValues,
  formatTimeValues,
  getTimeLabelFormat,
};
