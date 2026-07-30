export function formatMetricValue(value, unit) {
  if (!Number.isFinite(Number(value))) return "—";
  if (unit === "percent" || unit === "percentage_point") {
    return `${Number(value).toFixed(1)}%`;
  }
  if (unit?.startsWith("currency_")) {
    return new Intl.NumberFormat(undefined, {
      currency: unit.slice("currency_".length).toUpperCase(),
      maximumFractionDigits: 2,
      style: "currency",
    }).format(value);
  }
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAbsoluteDelta(value, unit) {
  if (!Number.isFinite(Number(value))) return "—";
  if (unit === "percentage_point") {
    return `${Math.abs(Number(value)).toFixed(1)} pp`;
  }
  return formatMetricValue(Math.abs(Number(value)), unit);
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
