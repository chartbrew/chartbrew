export function getObservationValueFormat(unit, valueFormat) {
  if (valueFormat) return valueFormat;
  if (unit?.startsWith("currency_")) {
    return {
      currency: unit.slice("currency_".length).toUpperCase(),
      mode: "override",
      scale: 1,
      type: "currency",
    };
  }
  if (unit === "percent_ratio") {
    return { mode: "override", scale: 100, type: "percentage" };
  }
  if (unit === "percent" || unit === "percentage_point") {
    return { mode: "override", scale: 1, type: "percentage" };
  }
  return { mode: "override", scale: 1, type: "number" };
}

export function formatMetricValue(value, unit, valueFormat) {
  if (!Number.isFinite(Number(value))) return "—";
  const format = getObservationValueFormat(unit, valueFormat);
  const displayValue = Number(value) * (Number(format.scale) || 1);
  if (format.type === "currency") {
    return new Intl.NumberFormat(undefined, {
      currency: format.currency,
      maximumFractionDigits: 2,
      style: "currency",
    }).format(displayValue);
  }
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(displayValue);
  if (format.type === "percentage") return `${formatted}%`;
  return `${format.prefix || ""}${formatted}${format.suffix || ""}`;
}

export function formatAbsoluteDelta(value, unit, valueFormat) {
  if (!Number.isFinite(Number(value))) return "—";
  const format = getObservationValueFormat(unit, valueFormat);
  if (format.type === "percentage") {
    return `${Math.abs(Number(value) * format.scale).toFixed(1)} pp`;
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
