import { describe, expect, it } from "vitest";

const { availableTools } = require("../../modules/ai/orchestrator/orchestrator");
const { ENTITY_CREATION_RULES, VALUE_FORMULA_SCHEMA } = require("../../modules/ai/orchestrator/entityCreationRules");
const { TOOLS } = require("../../modules/mcp/tools");
const { buildAiVisualization } = require("../../visualization/aiVisualization");
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");

describe("AI formula guidance", () => {
  it("gives every chart tool the same formula syntax at the top level and in value encodings", async () => {
    const tools = await availableTools();
    for (const name of ["create_chart", "create_temporary_chart", "create_dashboard_chart", "update_chart"]) {
      const properties = tools.find((tool) => tool.name === name).parameters.properties;
      expect(properties.formula).toEqual(VALUE_FORMULA_SCHEMA);
      expect(properties.encoding.properties.value.properties.formula).toEqual(VALUE_FORMULA_SCHEMA);
      expect(properties.visualization.properties.layers.items.properties.encoding.properties.value.properties.formula).toEqual(VALUE_FORMULA_SCHEMA);
    }
    expect(TOOLS.find((tool) => tool.name === "create_chart_preview").inputSchema.properties.formula).toEqual(VALUE_FORMULA_SCHEMA);
    expect(ENTITY_CREATION_RULES).toContain(VALUE_FORMULA_SCHEMA.description);
    expect(VALUE_FORMULA_SCHEMA.description).toContain("{val / 100}");
    expect(VALUE_FORMULA_SCHEMA.description).toContain("never value");
  });

  it("renders the documented division after KPI aggregation", () => {
    const chart = { id: 1, type: "kpi", name: "Revenue" };
    chart.visualization = buildAiVisualization({
      chart, bindingId: "revenue",
      encoding: { value: { field: "root[].amount", type: "quantitative", aggregate: "sum", formula: "{val / 100}" } },
    });
    const result = new VisualizationEngine({
      chart,
      datasets: [{ options: { id: "revenue", fieldsSchema: { "root[].amount": "number" } }, data: [{ amount: 12000 }, { amount: 345 }] }],
    }).render();
    expect(result.metadata.metrics[0].valueNumber).toBe(123.45);
  });
});
