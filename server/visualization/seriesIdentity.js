const crypto = require("crypto");

function serializeTypedValue(value) {
  if (value === null) return "null:";
  if (value === undefined) return "undefined:";
  if (value instanceof Date) return `date:${value.toISOString()}`;

  if (typeof value === "number") {
    if (Number.isNaN(value)) return "number:NaN";
    if (!Number.isFinite(value)) return `number:${value > 0 ? "Infinity" : "-Infinity"}`;
    if (Object.is(value, -0)) return "number:-0";
  }

  if (typeof value === "object") {
    return `object:${stableStringify(value)}`;
  }

  return `${typeof value}:${String(value)}`;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => {
      return `${JSON.stringify(key)}:${stableStringify(value[key])}`;
    }).join(",")}}`;
  }

  return JSON.stringify(value);
}

function createSeriesId(layerId, value) {
  const identity = `${layerId}|${serializeTypedValue(value)}`;
  const hash = crypto.createHash("sha256").update(identity).digest("hex").slice(0, 16);
  return `series-${hash}`;
}

function getSeriesLabel(value, fallback = "Series") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

module.exports = {
  createSeriesId,
  getSeriesLabel,
  serializeTypedValue,
  stableStringify,
};
