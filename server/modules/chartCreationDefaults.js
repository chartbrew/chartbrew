const { createHash } = require("node:crypto");

const OPERATIONS = ["none", "sum", "avg", "min", "max", "count", "count_unique"];
const TYPES = ["line", "bar", "horizontalBar", "pie", "doughnut", "table", "kpi", "avg", "map"];

function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function datasetDefaults(dataset, fields, choices = {}, rowCount = 0) {
  const entries = Object.entries(fields).filter(([, type]) => ["number", "string", "date", "boolean"].includes(type));
  const fieldChoices = entries.map(([value]) => ({ value, label: value.replace(/^root(?:\[\])?\./, "") }));
  const dates = entries.filter(([, type]) => type === "date");
  const xAxis = choices.xAxis || dataset.xAxis || (dates.length === 1 ? dates[0][0] : null);
  const yAxis = choices.yAxis || dataset.yAxis;
  const yAxisOperation = choices.yAxisOperation || dataset.yAxisOperation;
  const name = dataset.name || dataset.legend || "New chart";
  if (!yAxis || !fields[yAxis]) {
    return { question: "Which value would you like to show?", field: "yAxis", choices: fieldChoices };
  }
  if (!OPERATIONS.includes(yAxisOperation)) {
    return {
      question: "How should this value be calculated?", field: "yAxisOperation",
      choices: OPERATIONS.map((value) => ({ value, label: ({ none: "As provided", sum: "Total", avg: "Average", min: "Minimum", max: "Maximum", count: "Count", count_unique: "Unique count" })[value] })),
    };
  }
  if (xAxis && !fields[xAxis]) return { question: "Which field should group the values?", field: "xAxis", choices: fieldChoices };
  let type = yAxisOperation === "none" && rowCount > 1 ? "table" : "kpi";
  if (xAxis && xAxis !== yAxis) type = fields[xAxis] === "date" ? "line" : "bar";
  type = choices.type || type;
  return {
    name, type, xAxis: xAxis || yAxis, yAxis, yAxisOperation,
    dateField: dataset.dateField || (fields[xAxis] === "date" ? xAxis : undefined),
    dateFormat: dataset.dateFormat,
    conditions: dataset.conditions || [],
  };
}

function applyChartLimit(visualization, { maxRecords, sort } = {}) {
  if (maxRecords == null && sort == null) return visualization;
  if (maxRecords != null && (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 10000)) throw new Error("Invalid chart limit");
  if (sort != null && !["asc", "desc"].includes(sort)) throw new Error("Invalid chart sort");
  return { ...visualization, layers: visualization.layers.map((layer) => ({
    ...layer,
    transforms: [
      ...(layer.transforms || []).filter((item) => !(maxRecords != null && item.type === "limit") && !(sort && item.type === "sort")),
      ...(sort ? [{ type: "sort", role: "value", direction: sort }] : []),
      ...(maxRecords != null ? [{ type: "limit", count: maxRecords }] : []),
    ],
  })) };
}

module.exports = { datasetDefaults, fingerprint, applyChartLimit, OPERATIONS, TYPES };
