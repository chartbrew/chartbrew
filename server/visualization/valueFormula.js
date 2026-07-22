const FormulaParser = require("hot-formula-parser").Parser;

const parser = new FormulaParser();

function parseValueFormula(formula) {
  if (typeof formula !== "string" || formula.length === 0) {
    return {
      expression: "val",
      prefix: "",
      suffix: "",
    };
  }

  const openIndex = formula.indexOf("{");
  const closeIndex = formula.indexOf("}", openIndex + 1);
  if (openIndex === -1 || closeIndex === -1) {
    return {
      expression: "val",
      prefix: "",
      suffix: "",
    };
  }

  return {
    expression: formula.slice(openIndex + 1, closeIndex).trim() || "val",
    prefix: formula.slice(0, openIndex),
    suffix: formula.slice(closeIndex + 1),
  };
}

function toNumericValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === "") return null;
  const matches = `${value}`.replaceAll(",", "").match(/-?[\d.]+/g);
  if (!matches) return null;
  const numeric = Number(matches.find((match) => match !== "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function evaluateValueFormula(value, formula) {
  const parsed = parseValueFormula(formula);
  const numericInput = toNumericValue(value);
  if (numericInput === null) {
    return {
      ...parsed,
      formattedValue: value,
      numericValue: value,
    };
  }

  const expression = parsed.expression.replace(/\bval\b/g, `(${numericInput})`);
  const result = parser.parse(expression);
  const numericValue = toNumericValue(result.result);
  const finalValue = numericValue === null ? numericInput : numericValue;

  return {
    ...parsed,
    formattedValue: `${parsed.prefix}${finalValue.toLocaleString()}${parsed.suffix}`,
    numericValue: finalValue,
  };
}

function applyValueFormula(value, formula, options = {}) {
  if (!formula) return value;
  const result = evaluateValueFormula(value, formula);
  if (options.formatted) return result.formattedValue;
  if (typeof result.numericValue !== "number") return result.numericValue;
  return Number(result.numericValue.toFixed(2));
}

module.exports = {
  applyValueFormula,
  evaluateValueFormula,
  parseValueFormula,
  toNumericValue,
};
