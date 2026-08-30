import { describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine.js");
const { compileTabularExport } = require("../../visualization/compilers/tabularExport.js");

function buildEngine(mark, encoding, data, layer = {}, chart = {}, datasetOptions = {}) {
  return new VisualizationEngine({
    chart: {
      displayLegend: true,
      mode: "chart",
      name: "Chart as shown",
      type: mark,
      ...chart,
      visualization: {
        layers: [{
          bindingId: "source-main",
          encoding,
          id: "main",
          mark,
          name: layer.name || "Revenue",
          ...layer,
        }],
        settings: {},
        status: "ready",
        version: 2,
      },
    },
    datasets: [{
      data,
      options: {
        id: "source-main",
        ...datasetOptions,
      },
    }],
    timezone: "UTC",
  });
}

describe("visualization output compilers", () => {
  it("compiles graphical charts directly to ECharts", () => {
    const result = buildEngine("line", {
      category: { field: "root[].month", type: "nominal" },
      value: { aggregate: "sum", field: "root[].amount", type: "quantitative" },
    }, [
      { amount: 12, month: "Jan" },
      { amount: 18, month: "Feb" },
    ]).render();

    expect(result.renderer).toBe("echarts");
    expect(result.configuration.dataset.source).toEqual([
      ["Jan", 12],
      ["Feb", 18],
    ]);
    expect(result.metadata.series).toHaveLength(1);
    expect(result.tabularData["Chart as shown"]).toEqual([
      { Category: "Jan", Revenue: 12 },
      { Category: "Feb", Revenue: 18 },
    ]);
    expect(result).not.toHaveProperty("chartData");
  });

  it("compiles KPI values, comparisons, and goals without Chart.js data", () => {
    const result = buildEngine("kpi", {
      value: {
        aggregate: "sum",
        field: "root[].amount",
        formula: "${val} USD",
        type: "quantitative",
      },
    }, [
      { amount: 1200 },
      { amount: 800 },
    ], {
      goal: 2500,
      name: "Revenue",
    }).render();

    expect(result.renderer).toBe("native");
    expect(result.configuration.items).toEqual([
      expect.objectContaining({
        goal: 2500,
        label: "Revenue",
        value: "$2,000 USD",
        valueNumber: 2000,
      }),
    ]);
    expect(result.metadata.metrics).toEqual(result.configuration.items);
    expect(result.tabularData["Chart as shown"]).toEqual([
      { Category: "Value", Revenue: "$2,000 USD" },
    ]);
    expect(result).not.toHaveProperty("chartData");
  });

  it("compiles average metrics as a native item", () => {
    const result = buildEngine("avg", {
      value: { aggregate: "avg", field: "root[].duration", type: "quantitative" },
    }, [
      { duration: 10 },
      { duration: 20 },
      { duration: 30 },
    ], { name: "Average duration" }).render();

    expect(result.configuration.items).toEqual([
      expect.objectContaining({
        label: "Average duration",
        value: "20",
        valueNumber: 20,
      }),
    ]);
  });

  it("compiles tables with ordering, exclusions, and formatting", () => {
    const result = buildEngine("table", {}, {
      payload: {
        rows: [
          { internal: "ignore", name: "Starter", revenue: 1234.5 },
          { internal: "ignore", name: "Advanced", revenue: 2500 },
        ],
      },
    }, {
      name: "Programs",
      options: {
        columnsOrder: ["name", "revenue"],
        configuration: {
          columnsFormatting: {
            revenue: {
              decimals: 0,
              thousandsSeparator: true,
              type: "number",
            },
          },
        },
        excludedFields: ["internal"],
      },
      rowPath: "root.payload.rows[]",
    }).render();

    expect(result.renderer).toBe("native");
    expect(result.configuration.Programs.columns.map((column) => column.Header)).toEqual([
      "name",
      "revenue",
    ]);
    expect(result.configuration.Programs.data).toEqual([
      { name: "Starter", revenue: "1,235" },
      { name: "Advanced", revenue: "2,500" },
    ]);
    expect(result.tabularData).toBe(result.configuration);
    expect(result).not.toHaveProperty("chartData");
  });

  it("exports filtered source rows", () => {
    const result = buildEngine("bar", {
      category: { field: "root[].program", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    }, [
      { currency: "EUR", program: "Ceramics", revenue: 80 },
      { currency: "USD", program: "Writing", revenue: 120 },
    ], {
      name: "Program revenue",
      transforms: [{
        field: "root[].currency",
        operator: "equals",
        type: "filter",
        value: "EUR",
      }],
    }).export();

    expect(result.configuration).toEqual({
      "Program revenue": [{ currency: "EUR", program: "Ceramics", revenue: 80 }],
    });
  });

  it("exports shown rows from prepared data without calling render", () => {
    const engine = buildEngine("bar", {
      category: { field: "root[].program", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    }, [{ program: "Ceramics", revenue: 80 }], { name: "Revenue" });
    engine.render = vi.fn(() => {
      throw new Error("render must not run");
    });

    expect(engine.export({ mode: "shown" }).configuration).toEqual({
      "Chart as shown": [{ Category: "Ceramics", Revenue: 80 }],
    });
    expect(engine.render).not.toHaveBeenCalled();
  });

  it("exports one source table for shared bindings", () => {
    const result = compileTabularExport({
      conditionsOptions: [],
      datasets: [{
        data: [{ cost: 60, month: "Jan", revenue: 100 }],
        options: { id: "shared", legend: "Financials" },
      }],
      visualization: {
        layers: ["revenue", "cost"].map((field) => ({
          bindingId: "shared",
          encoding: {
            category: { field: "root[].month", type: "nominal" },
            value: { field: `root[].${field}`, type: "quantitative" },
          },
          id: field,
          mark: "line",
          name: field,
        })),
        version: 2,
      },
    });

    expect(result.configuration).toEqual({
      Financials: [{ cost: 60, month: "Jan", revenue: 100 }],
    });
  });
});
