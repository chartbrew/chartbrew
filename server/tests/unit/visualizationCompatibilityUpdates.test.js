import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  applyCdcCompatibilityUpdate,
  applyChartCompatibilityUpdate,
} = require("../../visualization/compatibilityUpdates.js");

const nativeVisualization = {
  version: 2,
  metadata: { createdBy: "visualization-editor" },
  layers: [{
    bindingId: "cdc-income",
    encoding: {
      breakdown: { field: "root[].level", type: "nominal" },
      category: { field: "root[].program", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    },
    id: "income",
    mark: "bar",
    style: {},
    transforms: [],
  }],
};

describe("native visualization compatibility updates", () => {
  it("keeps breakdown fields while mirroring legacy display controls", () => {
    const next = applyCdcCompatibilityUpdate(nativeVisualization, "cdc-income", {
      datasetColor: "#123456",
      formula: "${val / 100}",
      legend: "Income",
    });

    expect(next.layers[0].encoding.breakdown.field).toBe("root[].level");
    expect(next.layers[0].encoding.value.formula).toBe("${val / 100}");
    expect(next.layers[0].style.color).toBe("#123456");
    expect(next.layers[0].name).toBe("Income");
  });

  it("keeps a native spec valid when the legacy chart-type control changes", () => {
    const next = applyChartCompatibilityUpdate(nativeVisualization, { type: "kpi" });

    expect(next.layers[0].mark).toBe("kpi");
    expect(next.layers[0].encoding).toEqual({
      value: nativeVisualization.layers[0].encoding.value,
    });
    expect(next.metadata.createdBy).toBe("visualization-editor");
  });

  it("initializes the row collection when the preview control selects a table", () => {
    const next = applyChartCompatibilityUpdate(nativeVisualization, { type: "table" });

    expect(next.layers[0].mark).toBe("table");
    expect(next.layers[0].encoding).toEqual({});
    expect(next.layers[0].rowPath).toBe("root[]");
  });
});
