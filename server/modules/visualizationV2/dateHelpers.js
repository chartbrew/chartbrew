const momentObj = require("moment");

function getMomentFactory(timezone = "") {
  if (timezone) {
    return (...args) => momentObj(...args).tz(timezone);
  }

  return (...args) => momentObj.utc(...args);
}

function normalizeMomentValue(value, timezone = "") {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const moment = getMomentFactory(timezone);
  const stringValue = typeof value === "string" ? value : `${value}`;

  if (/^\d{10}$/.test(stringValue)) {
    return moment(stringValue, "X");
  }

  if (/^\d{13}$/.test(stringValue)) {
    return moment(stringValue, "x");
  }

  return moment(value);
}

function getBucketStart(dateMoment, timeInterval = "day") {
  if (!dateMoment || typeof dateMoment.clone !== "function") {
    return null;
  }

  const nextMoment = dateMoment.clone();

  switch (timeInterval) {
    case "week":
      return nextMoment.startOf("isoWeek");
    case "month":
      return nextMoment.startOf("month");
    case "year":
      return nextMoment.startOf("year");
    case "hour":
      return nextMoment.startOf("hour");
    case "minute":
      return nextMoment.startOf("minute");
    case "second":
      return nextMoment.startOf("second");
    case "day":
    default:
      return nextMoment.startOf("day");
  }
}

function addBucket(dateMoment, timeInterval = "day", amount = 1) {
  if (!dateMoment || typeof dateMoment.clone !== "function") {
    return null;
  }

  const nextMoment = dateMoment.clone();
  const interval = timeInterval === "week" ? "week" : timeInterval;
  return nextMoment.add(amount, interval);
}

function getDateLabelFormat(timeInterval = "day") {
  switch (timeInterval) {
    case "second":
      return "YYYY-MM-DD HH:mm:ss";
    case "minute":
      return "YYYY-MM-DD HH:mm";
    case "hour":
      return "YYYY-MM-DD HH:00";
    case "week":
      return "GGGG [W] WW";
    case "month":
      return "MMM YYYY";
    case "year":
      return "YYYY";
    case "day":
    default:
      return "YYYY-MM-DD";
  }
}

function formatDateBucket(dateMoment, timeInterval = "day", explicitDateFormat = null) {
  const dateFormat = explicitDateFormat || getDateLabelFormat(timeInterval);

  return {
    dateFormat,
    label: dateMoment.format(dateFormat),
  };
}

function getResolvedChartDateWindow(chart = {}, timezone = "") {
  if (!chart?.startDate || !chart?.endDate) {
    return {
      startDate: null,
      endDate: null,
    };
  }

  const moment = getMomentFactory(timezone);
  let startDate = moment(chart.startDate);
  let endDate = moment(chart.endDate);

  if (chart.timeInterval === "month" && chart.currentEndDate && !chart.fixedStartDate) {
    startDate = startDate.startOf("month").startOf("day");
  } else if (chart.timeInterval === "year" && chart.currentEndDate && !chart.fixedStartDate) {
    startDate = startDate.startOf("year").startOf("day");
  } else if (!chart.fixedStartDate) {
    startDate = startDate.startOf("day");
  }

  endDate = endDate.endOf("day");

  if (chart.currentEndDate) {
    const timeDiff = endDate.diff(startDate, chart.timeInterval);
    endDate = moment().endOf(chart.timeInterval);

    if (!chart.fixedStartDate) {
      startDate = endDate.clone()
        .subtract(timeDiff, chart.timeInterval)
        .startOf(chart.timeInterval);
    }
  }

  return {
    startDate,
    endDate,
  };
}

function createFilledDateBuckets({
  observedBuckets = [],
  chart,
  includeZeros = false,
  timezone = "",
}) {
  const sortedObservedBuckets = [...observedBuckets]
    .filter(Boolean)
    .sort((a, b) => a.valueOf() - b.valueOf());

  if (sortedObservedBuckets.length === 0) {
    return [];
  }

  if (
    !includeZeros
    || chart?.timeInterval === "minute"
    || chart?.timeInterval === "second"
  ) {
    return sortedObservedBuckets;
  }

  const { startDate, endDate } = getResolvedChartDateWindow(chart, timezone);
  const effectiveStart = getBucketStart(startDate || sortedObservedBuckets[0], chart?.timeInterval);
  const effectiveEnd = getBucketStart(
    endDate || sortedObservedBuckets[sortedObservedBuckets.length - 1],
    chart?.timeInterval,
  );

  if (!effectiveStart || !effectiveEnd) {
    return sortedObservedBuckets;
  }

  const filledBuckets = [];
  let cursor = effectiveStart.clone();

  while (cursor.isSameOrBefore(effectiveEnd)) {
    filledBuckets.push(cursor.clone());
    cursor = addBucket(cursor, chart?.timeInterval, 1);
  }

  return filledBuckets;
}

module.exports = {
  addBucket,
  createFilledDateBuckets,
  formatDateBucket,
  getBucketStart,
  getDateLabelFormat,
  getMomentFactory,
  getResolvedChartDateWindow,
  normalizeMomentValue,
};
