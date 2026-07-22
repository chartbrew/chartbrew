import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildAiVisualization } = require("../../visualization/aiVisualization.js");

describe("AI canonical visualization builder", () => {
  it("creates canonical encodings directly when semantic fields are provided", () => {
    const visualization = buildAiVisualization({
      bindingId: "orders",
      chart: { type: "bar", stacked: true },
      cdc: { legend: "Revenue" },
      encoding: {
        category: { field: "root[].branch", type: "nominal" },
        breakdown: { field: "root[].level", type: "nominal" },
        value: { field: "root[].revenue", type: "quantitative", aggregate: "sum" },
      },
      goal: 1000,
    });

    expect(visualization.metadata).toEqual({ createdBy: "ai" });
    expect(visualization.layers[0]).toEqual(expect.objectContaining({
      bindingId: "orders",
      goal: 1000,
      mark: "bar",
      stack: "normal",
    }));
    expect(visualization.layers[0].encoding.breakdown.field).toBe("root[].level");
  });

  it("still converts legacy AI field arguments into a native-owned spec", () => {
    const visualization = buildAiVisualization({
      chart: { type: "line" },
      cdc: {
        xAxis: "root[].createdAt",
        yAxis: "root[].count",
        yAxisOperation: "sum",
      },
    });

    expect(visualization.metadata).toEqual({ createdBy: "ai" });
    expect(visualization.layers[0].encoding.value).toEqual(expect.objectContaining({
      field: "root[].count",
      aggregate: "sum",
    }));
  });

  it("removes AI x/y aliases when canonical line roles are also present", () => {
    const visualization = buildAiVisualization({
      bindingId: "charts-created",
      visualization: {
        version: 2,
        layers: [{
          id: "charts-created",
          mark: "line",
          encoding: {
            x: { field: "month" },
            y: { field: "count" },
            time: { field: "root[].month", type: "temporal" },
            value: { field: "root[].count", type: "quantitative" },
          },
        }],
      },
    });

    expect(visualization.layers[0].encoding).toEqual({
      time: { field: "root[].month", type: "temporal" },
      value: { field: "root[].count", type: "quantitative" },
    });
  });

  it("converts x/y-only AI line encodings into semantic roles", () => {
    const visualization = buildAiVisualization({
      bindingId: "orders",
      encoding: {
        x: { field: "root[].createdAt", type: "temporal" },
        y: { field: "root[].total", type: "quantitative", aggregate: "sum" },
      },
      chart: { type: "line" },
    });

    expect(visualization.layers[0].encoding).toEqual({
      time: { field: "root[].createdAt", type: "temporal" },
      value: { field: "root[].total", type: "quantitative", aggregate: "sum" },
    });
  });

  it("rejects unsupported AI encoding roles before persistence", () => {
    expect(() => buildAiVisualization({
      bindingId: "orders",
      encoding: {
        category: { field: "root[].region", type: "nominal" },
        value: { field: "root[].total", type: "quantitative" },
        colorBy: { field: "root[].segment", type: "nominal" },
      },
      chart: { type: "bar" },
    })).toThrow("AI visualization encoding role \"colorBy\" is not valid for bar");
  });
});
