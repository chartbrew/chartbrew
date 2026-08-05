const { evaluateValueFormula, parseValueFormula } = require("../../visualization/valueFormula");

const CURRENCY_BY_SYMBOL = {
  "$": "USD",
  "£": "GBP",
  "€": "EUR",
};
const VALUE_MEANINGS = new Set(["currency", "number", "percentage"]);
const DISPLAY_NOTATIONS = new Set(["compact", "standard"]);

function inferScale(formula) {
  if (!formula) return 1;
  const input = 0.125;
  const result = evaluateValueFormula(input, formula).numericValue;
  if (!Number.isFinite(result) || input === 0) return 1;
  const scale = result / input;
  return Number.isFinite(scale) && scale !== 0 ? scale : 1;
}

function normalizeDecimals(value) {
  if (value === undefined || value === null || value === "auto") return null;
  const decimals = Number(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    throw new Error("Choose between 0 and 6 decimal places");
  }
  return decimals;
}

function normalizeNotation(value) {
  const notation = value || "standard";
  if (!DISPLAY_NOTATIONS.has(notation)) {
    throw new Error("Choose a valid number style");
  }
  return notation;
}

function getMeaning(valueFormat = {}) {
  return valueFormat.meaning || valueFormat.type || "number";
}

function getDisplay(valueFormat = {}) {
  return valueFormat.display || valueFormat;
}

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

function inferChartValueFormat(formula) {
  const parsed = parseValueFormula(formula);
  const prefix = parsed.prefix.trim();
  const suffix = parsed.suffix.trim();
  const currency = CURRENCY_BY_SYMBOL[prefix] || null;
  let meaning = "number";
  if (suffix === "%") meaning = "percentage";
  else if (currency) meaning = "currency";

  return buildValueFormat({
    currency,
    meaning,
    mode: "chart",
    prefix: currency ? "" : parsed.prefix,
    scale: inferScale(formula),
    suffix: suffix === "%" ? "" : parsed.suffix,
  });
}

function fromLegacyUnit(unit) {
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

function normalizeValueFormat(valueFormat, formula, legacyUnit) {
  if (!valueFormat && legacyUnit) return fromLegacyUnit(legacyUnit);
  if (!valueFormat || valueFormat.mode === "chart") {
    return inferChartValueFormat(formula);
  }

  const meaning = getMeaning(valueFormat);
  if (!VALUE_MEANINGS.has(meaning)) {
    throw new Error("Choose what this metric represents");
  }

  const source = getDisplay(valueFormat);
  const decimals = normalizeDecimals(source.decimals);
  const notation = normalizeNotation(source.notation);
  if (meaning === "currency") {
    const currency = `${source.currency || valueFormat.currency || ""}`.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("Choose a valid currency");
    }
    return buildValueFormat({ currency, decimals, meaning, notation });
  }
  if (meaning === "percentage") {
    const scale = Number(source.scale ?? valueFormat.scale);
    if (![1, 100].includes(scale)) {
      throw new Error("Choose how percentage values are stored");
    }
    return buildValueFormat({ decimals, meaning, notation, scale });
  }
  return buildValueFormat({ decimals, meaning, notation });
}

function toLegacyUnit(valueFormat) {
  const meaning = getMeaning(valueFormat);
  const display = getDisplay(valueFormat);
  if (meaning === "currency") {
    return `currency_${display.currency.toLowerCase()}`;
  }
  if (meaning === "percentage") {
    return Number(display.scale) === 100 ? "percent_ratio" : "percent";
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
  const meaning = getMeaning(valueFormat);
  const display = getDisplay(valueFormat);
  const displayValue = numericValue * (Number(display.scale) || 1);
  const hasFixedDecimals = Number.isInteger(display.decimals);
  let fractionDigits = 2;
  if (hasFixedDecimals) fractionDigits = display.decimals;
  else if (display.notation === "compact") fractionDigits = 1;
  const options = {
    maximumFractionDigits: fractionDigits,
    notation: normalizeNotation(display.notation),
  };
  if (hasFixedDecimals) options.minimumFractionDigits = fractionDigits;

  if (meaning === "currency") {
    return new Intl.NumberFormat("en", {
      ...options,
      currency: display.currency,
      style: "currency",
    }).format(displayValue);
  }
  const formatted = new Intl.NumberFormat("en", options).format(displayValue);
  if (meaning === "percentage") return `${formatted}%`;
  return `${display.prefix || ""}${formatted}${display.suffix || ""}`;
}

module.exports = {
  buildValueFormat,
  formatMetricValue,
  fromLegacyUnit,
  getValueFormat,
  inferChartValueFormat,
  normalizeValueFormat,
  toLegacyUnit,
};
