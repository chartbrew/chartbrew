const MARK_DEFINITIONS = Object.freeze({
  line: {
    label: "Line",
    requiredOneOf: [["time", "category"]],
    slots: {
      time: { kind: "dimension", types: ["temporal"] },
      category: { kind: "dimension", types: ["nominal", "ordinal", "temporal"] },
      value: { kind: "measure", required: true, types: ["quantitative"] },
      breakdown: { kind: "dimension", types: ["nominal", "ordinal"] },
    },
  },
  bar: {
    label: "Bar",
    requiredOneOf: [["category", "time"]],
    slots: {
      category: { kind: "dimension", types: ["nominal", "ordinal", "temporal"] },
      time: { kind: "dimension", types: ["temporal"] },
      value: { kind: "measure", required: true, types: ["quantitative"] },
      breakdown: { kind: "dimension", types: ["nominal", "ordinal"] },
    },
  },
  pie: {
    label: "Pie",
    slots: {
      category: { kind: "dimension", required: true, types: ["nominal", "ordinal"] },
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  doughnut: {
    label: "Doughnut",
    slots: {
      category: { kind: "dimension", required: true, types: ["nominal", "ordinal"] },
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  radar: {
    label: "Radar",
    slots: {
      category: { kind: "dimension", required: true, types: ["nominal", "ordinal"] },
      value: { kind: "measure", required: true, types: ["quantitative"] },
      breakdown: { kind: "dimension", types: ["nominal", "ordinal"] },
    },
  },
  polar: {
    label: "Polar area",
    slots: {
      category: { kind: "dimension", required: true, types: ["nominal", "ordinal"] },
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  kpi: {
    label: "KPI",
    slots: {
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  avg: {
    label: "Average",
    slots: {
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  gauge: {
    label: "Gauge",
    slots: {
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  table: {
    label: "Table",
    passthrough: true,
    slots: {
      columns: { kind: "fieldList", multiple: true },
    },
  },
  matrix: {
    label: "Matrix",
    requiredOneOf: [["time", "row"], ["time", "column"]],
    slots: {
      time: { kind: "dimension", types: ["temporal"] },
      row: { kind: "dimension", types: ["nominal", "ordinal", "temporal"] },
      column: { kind: "dimension", types: ["nominal", "ordinal", "temporal"] },
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  markdown: {
    label: "Markdown",
    bindingRequired: false,
    passthrough: true,
    slots: {},
  },
  scatter: {
    label: "Scatter",
    slots: {
      x: { kind: "measure", required: true, types: ["quantitative", "temporal"] },
      y: { kind: "measure", required: true, types: ["quantitative"] },
      breakdown: { kind: "dimension", types: ["nominal", "ordinal"] },
      size: { kind: "measure", types: ["quantitative"] },
      detail: { kind: "dimension", types: ["nominal", "ordinal"] },
    },
  },
  map: {
    label: "Map",
    requiredOneOf: [["location", "latitude"]],
    slots: {
      location: { kind: "dimension", types: ["nominal", "ordinal"] },
      latitude: { kind: "measure", types: ["quantitative"] },
      longitude: { kind: "measure", types: ["quantitative"] },
      value: { kind: "measure", types: ["quantitative"] },
      breakdown: { kind: "dimension", types: ["nominal", "ordinal"] },
    },
  },
  treemap: {
    label: "Treemap",
    slots: {
      hierarchy: { kind: "dimension", required: true, multiple: true },
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  sunburst: {
    label: "Sunburst",
    slots: {
      hierarchy: { kind: "dimension", required: true, multiple: true },
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  sankey: {
    label: "Sankey",
    slots: {
      source: { kind: "dimension", required: true },
      target: { kind: "dimension", required: true },
      value: { kind: "measure", required: true, types: ["quantitative"] },
    },
  },
  histogram: {
    label: "Histogram",
    slots: {
      value: { kind: "measure", required: true, types: ["quantitative"] },
      breakdown: { kind: "dimension", types: ["nominal", "ordinal"] },
    },
  },
  boxplot: {
    label: "Box plot",
    slots: {
      category: { kind: "dimension", types: ["nominal", "ordinal"] },
      value: { kind: "measure", required: true, types: ["quantitative"] },
      breakdown: { kind: "dimension", types: ["nominal", "ordinal"] },
    },
  },
});

function getMarkDefinition(mark) {
  return MARK_DEFINITIONS[mark] || null;
}

function getMarkNames() {
  return Object.keys(MARK_DEFINITIONS);
}

function getSlotDefinition(mark, slot) {
  return getMarkDefinition(mark)?.slots?.[slot] || null;
}

module.exports = {
  MARK_DEFINITIONS,
  getMarkDefinition,
  getMarkNames,
  getSlotDefinition,
};
