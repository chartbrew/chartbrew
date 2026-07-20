import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getMarkDefinition } = require("../../visualization/registry.js");
const {
  assertVisualizationSpec,
  validateVisualizationSpec,
} = require("../../visualization/spec.js");

describe("visualization specification", () => {
  it("models a bar breakdown without persisting individual series", () => {
    const result = validateVisualizationSpec({
      version: 2,
      layers: [{
        id: "income",
        bindingId: "cdc-1",
        mark: "bar",
        encoding: {
          category: { field: "root[].program", type: "nominal" },
          value: { field: "root[].revenue", type: "quantitative", aggregate: "sum" },
          breakdown: { field: "root[].level", type: "nominal" },
        },
      }],
    });

    expect(result.valid).toBe(true);
    expect(result.spec.layers[0].encoding.breakdown.field).toBe("root[].level");
    expect(result.spec.layers[0]).not.toHaveProperty("series");
  });

  it("supports value-only visualizations without fake axes", () => {
    const spec = assertVisualizationSpec({
      version: 2,
      layers: [{
        id: "total",
        bindingId: "cdc-1",
        mark: "kpi",
        encoding: {
          value: { field: "root.total", type: "quantitative", aggregate: "none" },
        },
      }],
    });

    expect(spec.layers[0].encoding).toEqual({
      value: { field: "root.total", type: "quantitative", aggregate: "none" },
    });
  });

  it("allows incomplete draft specifications but validates ready charts strictly", () => {
    const draft = validateVisualizationSpec({
      version: 2,
      status: "draft",
      layers: [{ id: "draft", mark: "line", encoding: {} }],
    });
    const ready = validateVisualizationSpec({
      version: 2,
      layers: [{ id: "ready", bindingId: "cdc-1", mark: "line", encoding: {} }],
    });

    expect(draft.valid).toBe(true);
    expect(ready.valid).toBe(false);
    expect(ready.errors).toContain("layers[0].encoding.value is required for line");
  });

  it("declares semantic slots per mark instead of a universal X/Y contract", () => {
    expect(getMarkDefinition("kpi").slots).toEqual({
      value: { kind: "measure", required: true, types: ["quantitative"] },
    });
    expect(getMarkDefinition("sankey").slots).toHaveProperty("source");
    expect(getMarkDefinition("sankey").slots).toHaveProperty("target");
  });

  it("rejects transforms the current engine cannot execute", () => {
    const result = validateVisualizationSpec({
      version: 2,
      layers: [{
        id: "income",
        bindingId: "cdc-1",
        mark: "bar",
        encoding: {
          category: { field: "root[].program" },
          value: { field: "root[].revenue", aggregate: "sum" },
        },
        transforms: [{ type: "window", operation: "rank" }],
      }],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("layers[0].transforms[0].operation is not supported");
  });
});
