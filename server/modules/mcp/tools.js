const { getReadyPresets, getMarkDefinition } = require("../../visualization/registry");
const { AGGREGATIONS } = require("../../visualization/spec");

const id = { type: "integer", minimum: 1 };
const text = { type: "string", minLength: 1, maxLength: 200 };
const limit = { type: "integer", minimum: 1, maximum: 50, default: 20 };
const dataOptions = {
  filters: { type: "array", maxItems: 50, items: { type: "object" } },
  variables: { type: "object", maxProperties: 100 },
  refresh: { type: "boolean", default: false },
};

function tool(name, description, properties, required = [], scope = "data:read") {
  return {
    name, description, scope,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    outputSchema: { type: "object", properties: { result: { type: "object" } }, required: ["result"], additionalProperties: false },
    annotations: { readOnlyHint: !["create_chart_preview", "explore_data"].includes(name), destructiveHint: false, openWorldHint: true },
  };
}

const TOOLS = [
  tool("search_workspace", "Find accessible dashboards, charts, and datasets by name. Links require Chartbrew sign-in.", {
    query: { ...text, minLength: 0 }, types: { type: "array", items: { enum: ["dashboard", "chart", "dataset"] }, maxItems: 3 }, limit,
  }),
  tool("get_workspace_activity", "Read recent changes and metric evaluations in the key's team and projects.", {
    projectId: id, from: { type: "string", format: "date-time" }, to: { type: "string", format: "date-time" }, limit,
  }),
  tool("run_dataset", "Read an existing dataset. Refresh requires data:refresh. Uses Data API filters, variables, and limits.", {
    datasetId: id, ...dataOptions, timezone: { type: "string", maxLength: 100 },
  }, ["datasetId"]),
  tool("get_chart_data", "Read chart data. Refresh requires data:refresh. Uses Data API filters, variables, and limits.", {
    projectId: id, chartId: id, ...dataOptions,
  }, ["projectId", "chartId"]),
  tool("create_chart_preview", "Create a temporary chart from an accessible dataset. Does not place it in a dashboard. Requires a team-admin key with all-project access.", {
    datasetId: id, name: text,
    type: { enum: getReadyPresets().filter((preset) => getMarkDefinition(preset.mark)?.bindingRequired !== false).map((preset) => preset.id),
      description: "Chartbrew chart type. Use horizontalBar for horizontal bars; xAxis stays the category and yAxis the numeric value." },
    xAxis: text, yAxis: text, dateField: text, dateFormat: text,
    yAxisOperation: { enum: [...AGGREGATIONS], default: "none" },
    legend: text, displayLegend: { type: "boolean" }, dataLabels: { type: "boolean" },
    horizontal: { type: "boolean" }, stacked: { type: "boolean" }, includeZeros: { type: "boolean" },
    timeInterval: { enum: ["second", "minute", "hour", "day", "week", "month", "year"] },
    xLabelTicks: { enum: ["default", "half", "third", "fourth", "showAll"] },
    pointRadius: { type: "integer", minimum: 0, maximum: 50 },
    fill: { type: "boolean" }, multiFill: { type: "boolean" },
    datasetColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    fillColor: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    sort: { enum: ["asc", "desc"] }, maxRecords: { type: "integer", minimum: 1, maximum: 10000 },
    mode: { enum: ["chart", "kpichart"] }, showGrowth: { type: "boolean" }, invertGrowth: { type: "boolean" },
    subType: { enum: ["AddTimeseries"] }, goal: { type: "integer" },
    minValue: { type: "number" }, maxValue: { type: "number" },
    ranges: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: false,
      properties: { min: { type: "number" }, max: { type: "number" }, label: text, color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } }, required: ["min", "max"] } },
    excludedFields: { type: "array", maxItems: 100, items: text },
    columnsOrder: { type: "array", maxItems: 100, items: text },
    includeImage: { type: "boolean", default: false },
  }, ["datasetId", "name", "type"], "charts:preview"),
  tool("explore_data", "Inspect sources or preview a read-only request; save creates a dataset and requires datasets:write. Requires a team-admin key with all-project access. Never assumes field meanings.", {
    operation: { enum: ["inspect", "preview", "save"] },
    connectionId: id, projectId: id, name: text,
    search: { ...text, minLength: 0 }, names: { type: "array", maxItems: 3, items: text },
    query: { type: "string", maxLength: 20000 },
    configuration: { type: "object", description: "For MCP: {source:'mcp',tool:{name,contractFingerprint},arguments:{},output:{mode:'auto',path:[]}}. Use inspect for tool IDs, fingerprints, and schemas." }, limit,
  }, ["operation"]),
];

module.exports = { TOOLS };
