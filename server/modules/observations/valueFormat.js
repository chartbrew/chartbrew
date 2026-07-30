const { evaluateValueFormula, parseValueFormula } = require("../../visualization/valueFormula");

const CURRENCY_BY_SYMBOL = {
  "$": "USD",
  "£": "GBP",
  "€": "EUR",
};
const VALUE_TYPES = new Set(["currency", "number", "percentage"]);

function inferScale(formula) {
  if (!formula) return 1;
  const input = 0.125;
  const result = evaluateValueFormula(input, formula).numericValue;
  if (!Number.isFinite(result) || input === 0) return 1;
  const scale = result / input;
  return Number.isFinite(scale) && scale !== 0 ? scale : 1;
}

function inferChartValueFormat(formula) {
  const parsed = parseValueFormula(formula);
  const prefix = parsed.prefix.trim();
  const suffix = parsed.suffix.trim();
  const currency = CURRENCY_BY_SYMBOL[prefix] || null;
  let type = "number";
  if (suffix === "%") type = "percentage";
  else if (currency) type = "currency";

  return {
    currency,
    mode: "chart",
    prefix: currency ? "" : parsed.prefix,
    scale: inferScale(formula),
    suffix: suffix === "%" ? "" : parsed.suffix,
    type,
  };
}

function fromLegacyUnit(unit) {
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

function normalizeValueFormat(valueFormat, formula, legacyUnit) {
  if (!valueFormat && legacyUnit) return fromLegacyUnit(legacyUnit);
  if (!valueFormat || valueFormat.mode === "chart") {
    return inferChartValueFormat(formula);
  }
  if (!VALUE_TYPES.has(valueFormat.type)) {
    throw new Error("Choose how Chartbrew should display this metric");
  }

  if (valueFormat.type === "currency") {
    const currency = `${valueFormat.currency || ""}`.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("Choose a valid currency");
    }
    return { currency, mode: "override", scale: 1, type: "currency" };
  }
  if (valueFormat.type === "percentage") {
    const scale = Number(valueFormat.scale);
    if (![1, 100].includes(scale)) {
      throw new Error("Choose how percentage values are stored");
    }
    return { mode: "override", scale, type: "percentage" };
  }
  return { mode: "override", scale: 1, type: "number" };
}

function toLegacyUnit(valueFormat) {
  if (valueFormat.type === "currency") {
    return `currency_${valueFormat.currency.toLowerCase()}`;
  }
  if (valueFormat.type === "percentage") {
    return valueFormat.scale === 100 ? "percent_ratio" : "percent";
  }
  return "number";
}

function getValueFormat(metricSpec = {}) {
  return normalizeValueFormat(
    metricSpec.valueFormat,
    metricSpec.formula,
    metricSpec.unit || "number"
  );
}

function formatMetricValue(value, valueFormat) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  const format = valueFormat || { mode: "override", scale: 1, type: "number" };
  const displayValue = numericValue * (Number(format.scale) || 1);

  if (format.type === "currency") {
    return new Intl.NumberFormat("en", {
      currency: format.currency,
      maximumFractionDigits: 2,
      style: "currency",
    }).format(displayValue);
  }
  const formatted = new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(displayValue);
  if (format.type === "percentage") return `${formatted}%`;
  return `${format.prefix || ""}${formatted}${format.suffix || ""}`;
}

module.exports = {
  formatMetricValue,
  fromLegacyUnit,
  getValueFormat,
  inferChartValueFormat,
  normalizeValueFormat,
  toLegacyUnit,
};
