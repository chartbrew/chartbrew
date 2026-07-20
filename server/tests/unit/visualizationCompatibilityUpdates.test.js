import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  addBindingLayer,
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
    expect(next.layers[0].encoding.value.title).toBe("Income");
    expect(next.layers[0].style.color).toBe("#123456");
    expect(next.layers[0].style.label).toBe("Income");
    expect(next.layers[0].name).toBe("Income");
  });

  it("does not overwrite additional value labels when the dataset label changes", () => {
    const visualization = {
      ...nativeVisualization,
      layers: [
        nativeVisualization.layers[0],
        {
          ...nativeVisualization.layers[0],
          encoding: {
            ...nativeVisualization.layers[0].encoding,
            value: {
              ...nativeVisualization.layers[0].encoding.value,
              field: "root[].cost",
              title: "Cost",
            },
          },
          id: "cost",
          name: "Cost",
        },
      ],
    };

    const next = applyCdcCompatibilityUpdate(visualization, "cdc-income", {
      legend: "Financials",
    });

    expect(next.layers[0].name).toBe("Financials");
    expect(next.layers[1].name).toBe("Cost");
    expect(next.layers[1].encoding.value.title).toBe("Cost");
  });

  it("keeps a native spec valid when the legacy chart-type control changes", () => {
    const next = applyChartCompatibilityUpdate(nativeVisualization, { type: "kpi" });

    expect(next.layers[0].mark).toBe("kpi");
    expect(next.layers[0].encoding).toEqual({
      value: nativeVisualization.layers[0].encoding.value,
    });
    expect(next.layers[0].options.markState.bar.encoding)
      .toEqual(nativeVisualization.layers[0].encoding);
    expect(next.metadata.createdBy).toBe("visualization-editor");
  });

  it("restores category, value, and breakdown after a KPI round trip", () => {
    const kpi = applyChartCompatibilityUpdate(nativeVisualization, { type: "kpi" });
    const restored = applyChartCompatibilityUpdate(kpi, { type: "bar" });

    expect(restored.layers[0].mark).toBe("bar");
    expect(restored.layers[0].encoding).toEqual(nativeVisualization.layers[0].encoding);
  });

  it("restores the original aggregation after using the average chart", () => {
    const average = applyChartCompatibilityUpdate(nativeVisualization, { type: "avg" });
    const restored = applyChartCompatibilityUpdate(average, { type: "bar" });

    expect(average.layers[0].encoding.value.aggregate).toBe("avg");
    expect(restored.layers[0].encoding.value.aggregate).toBe("sum");
  });

  it("adds and removes accumulation transforms for every native layer", () => {
    const visualization = {
      ...nativeVisualization,
      layers: [
        nativeVisualization.layers[0],
        {
          ...nativeVisualization.layers[0],
          bindingId: "cdc-cost",
          id: "cost",
        },
      ],
    };
    const accumulated = applyChartCompatibilityUpdate(visualization, {
      subType: "AddTimeseries",
    });
    const restored = applyChartCompatibilityUpdate(accumulated, {
      subType: "timeseries",
    });

    accumulated.layers.forEach((layer) => {
      expect(layer.transforms).toContainEqual({
        operation: "cumulativeSum",
        role: "value",
        type: "window",
      });
    });
    restored.layers.forEach((layer) => {
      expect(layer.transforms).not.toContainEqual(expect.objectContaining({
        operation: "cumulativeSum",
      }));
    });
  });

  it("fills bars by default and remembers an explicit unfilled bar", () => {
    const line = {
      ...nativeVisualization,
      layers: [{
        ...nativeVisualization.layers[0],
        mark: "line",
        style: { fill: false },
      }],
    };
    const bar = applyChartCompatibilityUpdate(line, { type: "bar" });
    const unfilled = applyCdcCompatibilityUpdate(bar, "cdc-income", { fill: false });
    const roundTrip = applyChartCompatibilityUpdate(
      applyChartCompatibilityUpdate(unfilled, { type: "line" }),
      { type: "bar" }
    );

    expect(bar.layers[0].style.fill).toBe(true);
    expect(bar.layers[0].style.fillOpacity).toBe(0.65);
    expect(roundTrip.layers[0].style.fill).toBe(false);
  });

  it("initializes the row collection when the preview control selects a table", () => {
    const next = applyChartCompatibilityUpdate(nativeVisualization, { type: "table" });

    expect(next.layers[0].mark).toBe("table");
    expect(next.layers[0].encoding).toEqual({});
    expect(next.layers[0].rowPath).toBe("root[]");
  });

  it("adds one editable layer for a newly attached dataset", () => {
    const layer = {
      bindingId: "cdc-expenses",
      encoding: {
        category: { field: "root[].month", type: "nominal" },
        value: { aggregate: "sum", field: "root[].expenses", type: "quantitative" },
      },
      id: "expenses",
      mark: "bar",
      style: {},
      transforms: [],
    };

    const next = addBindingLayer(nativeVisualization, layer);
    const retried = addBindingLayer(next, layer);

    expect(next.layers).toHaveLength(2);
    expect(next.layers[1]).toEqual(layer);
    expect(next.metadata).toEqual(nativeVisualization.metadata);
    expect(next.status).toBe("ready");
    expect(retried.layers).toHaveLength(2);
  });

  it("marks a visualization as draft when the new dataset still needs fields", () => {
    const next = addBindingLayer(nativeVisualization, {
      bindingId: "cdc-unconfigured",
      encoding: {},
      id: "unconfigured",
      mark: "bar",
      style: {},
      transforms: [],
    });

    expect(next.status).toBe("draft");
  });
});
