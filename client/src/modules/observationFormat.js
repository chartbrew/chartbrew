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
