function buildValueFormat({
  currency = null,
  decimals = null,
  meaning = "number",
  mode = "override",
  notation = "standard",
  prefix = "",
  scale = 1,
  suffix = "",
}) {
  return {
    display: {
      currency,
      decimals,
      notation,
      prefix,
      scale,
      suffix,
    },
    meaning,
    mode,
  };
}

export function getObservationValueFormat(unit, valueFormat) {
  if (valueFormat) {
    const source = valueFormat.display || valueFormat;
    return buildValueFormat({
      currency: source.currency || valueFormat.currency || null,
      decimals: Number.isInteger(source.decimals) ? source.decimals : null,
      meaning: valueFormat.meaning || valueFormat.type || "number",
      mode: valueFormat.mode || "override",
      notation: source.notation || "standard",
      prefix: source.prefix || "",
      scale: Number(source.scale ?? valueFormat.scale) || 1,
      suffix: source.suffix || "",
    });
  }
  if (unit?.startsWith("currency_")) {
    return buildValueFormat({
      currency: unit.slice("currency_".length).toUpperCase(),
      meaning: "currency",
    });
  }
  if (unit === "percent_ratio") {
    return buildValueFormat({ meaning: "percentage", scale: 100 });
  }
  if (unit === "percent" || unit === "percentage_point") {
    return buildValueFormat({ meaning: "percentage" });
  }
  return buildValueFormat({ meaning: "number" });
}

export function createObservationValueFormat({
  currency,
  decimals,
  meaning,
  mode,
  notation,
  percentageScale,
}) {
  if (mode === "chart") return { mode: "chart" };
  return buildValueFormat({
    currency: meaning === "currency" ? currency || "USD" : null,
    decimals: decimals === "auto" || decimals == null ? null : Number(decimals),
    meaning,
    mode: "override",
    notation,
    scale: meaning === "percentage" ? Number(percentageScale) : 1,
  });
}

function getNumberOptions(format) {
  const hasFixedDecimals = Number.isInteger(format.display.decimals);
  const fractionDigits = hasFixedDecimals
    ? format.display.decimals
    : format.display.notation === "compact" ? 1 : 2;
  return {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: hasFixedDecimals ? fractionDigits : undefined,
    notation: format.display.notation,
  };
}

export function formatMetricValue(value, unit, valueFormat) {
  if (!Number.isFinite(Number(value))) return "—";
  const format = getObservationValueFormat(unit, valueFormat);
  const displayValue = Number(value) * format.display.scale;
  if (format.meaning === "currency") {
    return new Intl.NumberFormat(undefined, {
      ...getNumberOptions(format),
      currency: format.display.currency,
      style: "currency",
    }).format(displayValue);
  }
  const formatted = new Intl.NumberFormat(undefined, getNumberOptions(format)).format(displayValue);
  if (format.meaning === "percentage") return `${formatted}%`;
  return `${format.display.prefix}${formatted}${format.display.suffix}`;
}

export function formatAbsoluteDelta(value, unit, valueFormat) {
  if (!Number.isFinite(Number(value))) return "—";
  const format = getObservationValueFormat(unit, valueFormat);
  if (format.meaning === "percentage") {
    const pointValue = Math.abs(Number(value) * format.display.scale);
    const digits = Number.isInteger(format.display.decimals) ? format.display.decimals : 1;
    return `${pointValue.toFixed(digits)} pp`;
  }
  return formatMetricValue(Math.abs(Number(value)), unit, format);
}

function getDateParts(value, timezone) {
  const parts = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    timeZone: timezone || "UTC",
    year: "numeric",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function formatWeek(period, timezone, includeYear) {
  const start = getDateParts(period.start, timezone);
  const end = getDateParts(new Date(period.end).getTime() - 1, timezone);
  const year = includeYear ? `, ${start.year}` : "";
  if (start.year === end.year && start.month === end.month && start.day === end.day) {
    return `${start.month} ${start.day}${year}`;
  }
  if (start.year !== end.year) {
    return `${start.month} ${start.day}, ${start.year}–${end.month} ${end.day}, ${end.year}`;
  }
  if (start.month !== end.month) {
    return `${start.month} ${start.day}–${end.month} ${end.day}${year}`;
  }
  return `${start.month} ${start.day}–${end.day}${year}`;
}

function formatCompactPeriod(period, periodType, timezone, includeYear) {
  const start = getDateParts(period.start, timezone);
  if (periodType === "month") {
    return `${start.month}${includeYear ? ` ${start.year}` : ""}`;
  }
  if (periodType === "week") return formatWeek(period, timezone, includeYear);
  return `${start.month} ${start.day}${includeYear ? `, ${start.year}` : ""}`;
}

function getPeriodContext(observation) {
  const current = observation.currentPeriod;
  const previous = observation.comparisonPeriod;
  const periodType = observation.monitor?.comparisonPeriod;
  if (!current?.start || !current?.end || !previous?.start || !previous?.end || !periodType) {
    return null;
  }
  const timezone = observation.monitor?.comparisonTimezone || "UTC";
  const currentStart = getDateParts(current.start, timezone);
  const currentEnd = getDateParts(new Date(current.end).getTime() - 1, timezone);
  const previousStart = getDateParts(previous.start, timezone);
  const previousEnd = getDateParts(new Date(previous.end).getTime() - 1, timezone);
  const actualCurrentYear = getDateParts(new Date(), timezone).year;
  return {
    crossesYear: new Set([
      currentStart.year,
      currentEnd.year,
      previousStart.year,
      previousEnd.year,
    ]).size > 1,
    current,
    currentYear: currentStart.year,
    isHistorical: currentStart.year !== actualCurrentYear,
    periodType,
    previous,
    timezone,
  };
}

export function getCompactPeriodLabels(observation) {
  const context = getPeriodContext(observation);
  if (!context) {
    const [current, previous] = `${observation.comparisonLabel || ""}`
      .split(" compared with ");
    return {
      current: current || "Current period",
      previous: previous || "Previous period",
    };
  }
  const includeYear = context.crossesYear || context.isHistorical;
  let current = formatCompactPeriod(
    context.current,
    context.periodType,
    context.timezone,
    includeYear
  );
  let previous = formatCompactPeriod(
    context.previous,
    context.periodType,
    context.timezone,
    includeYear
  );
  if (current === previous
    && new Date(context.current.start).getTime() !== new Date(context.previous.start).getTime()) {
    current = formatCompactPeriod(context.current, "day", context.timezone, includeYear);
    previous = formatCompactPeriod(context.previous, "day", context.timezone, includeYear);
  }
  return { current, previous };
}

export function formatCompactComparison(observation) {
  const context = getPeriodContext(observation);
  if (!context) {
    return observation.comparisonLabel?.replace(" compared with ", " vs ") || null;
  }
  if (context.crossesYear) {
    const labels = getCompactPeriodLabels(observation);
    return `${labels.current} vs ${labels.previous}`;
  }
  let current = formatCompactPeriod(
    context.current,
    context.periodType,
    context.timezone,
    false
  );
  let previous = formatCompactPeriod(
    context.previous,
    context.periodType,
    context.timezone,
    false
  );
  if (current === previous
    && new Date(context.current.start).getTime() !== new Date(context.previous.start).getTime()) {
    current = formatCompactPeriod(context.current, "day", context.timezone, false);
    previous = formatCompactPeriod(context.previous, "day", context.timezone, false);
  }
  const historicalYear = context.isHistorical
    ? `${context.periodType === "month" ? " " : ", "}${context.currentYear}`
    : "";
  return `${current} vs ${previous}${historicalYear}`;
}

export function formatObservationChangeMagnitude(observation) {
  const valueFormat = getObservationValueFormat(
    observation.unit,
    observation.monitor?.valueFormat
  );
  if (valueFormat.meaning === "percentage") {
    const percentagePoints = Math.abs(
      Number(observation.absoluteDelta) * valueFormat.display.scale
    );
    const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
      .format(percentagePoints);
    return `${formatted} pp`;
  }
  if (observation.relativeDelta !== null
    && observation.relativeDelta !== undefined
    && Number.isFinite(Number(observation.relativeDelta))) {
    const percent = Math.abs(Number(observation.relativeDelta) * 100);
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(percent)}%`;
  }
  return formatAbsoluteDelta(
    observation.absoluteDelta,
    observation.unit,
    observation.monitor?.valueFormat
  );
}

export function formatRelativeChange(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return `${Math.abs(Number(value) * 100).toFixed(1)}%`;
}

export function formatTimeAgo(value) {
  if (!value) return "";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}
