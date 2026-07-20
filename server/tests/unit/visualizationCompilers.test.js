import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine.js");

function buildEngine(mark, encoding, data, layer = {}, chart = {}) {
  return new VisualizationEngine({
    chart: {
      displayLegend: true,
      mode: "chart",
      type: mark,
      ...chart,
      visualization: {
        version: 2,
        layers: [{
          bindingId: "cdc-main",
          encoding,
          id: "main",
          mark,
          ...layer,
        }],
      },
    },
    datasets: [{
      data,
      options: {
        id: "cdc-main",
      },
    }],
  });
}

describe("visualization output compilers", () => {
  it("compiles category values for pie-family charts", () => {
    const result = buildEngine("doughnut", {
      category: { field: "root[].channel", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    }, [
      { channel: "Direct", revenue: 40 },
      { channel: "Partner", revenue: 25 },
      { channel: "Direct", revenue: 15 },
    ]).render();

    expect(result.configuration.data.labels).toEqual(["Direct", "Partner"]);
    expect(result.configuration.data.datasets).toHaveLength(1);
    expect(result.configuration.data.datasets[0].data).toEqual([55, 25]);
    expect(result.configuration.options.scales.x.display).toBe(false);
  });

  it("compiles a value-only KPI with a formula and goal", () => {
    const result = buildEngine("kpi", {
      value: {
        aggregate: "sum",
        field: "root[].amount",
        formula: "${val / 1000}k",
        type: "quantitative",
      },
    }, [
      { amount: 1200 },
      { amount: 800 },
    ], { goal: 2500, name: "Revenue" }).render();

    expect(result.configuration.data.datasets[0].data).toEqual(["$2k"]);
    expect(result.configuration.growth[0]).toEqual(expect.objectContaining({
      label: "Revenue",
      value: "$2k",
    }));
    expect(result.configuration.goals[0]).toEqual(expect.objectContaining({
      max: 2500,
      value: 2,
    }));
  });

  it("compiles average metrics as a single value", () => {
    const result = buildEngine("avg", {
      value: { aggregate: "avg", field: "root[].duration", type: "quantitative" },
    }, [
      { duration: 10 },
      { duration: 20 },
      { duration: 30 },
    ], { name: "Average duration" }).render();

    expect(result.configuration.data.datasets[0].data).toEqual([20]);
  });

  it("compiles nested table rows with ordering, exclusions, and formatting", () => {
    const engine = buildEngine("table", {}, {
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
    });
    const result = engine.render();

    expect(result.configuration.Programs.columns.map((column) => column.Header)).toEqual([
      "name",
      "revenue",
    ]);
    expect(result.configuration.Programs.data).toEqual([
      { name: "Starter", revenue: "1,235" },
      { name: "Advanced", revenue: "2,500" },
    ]);
  });

  it("exports filtered source rows through the same visualization facade", () => {
    const engine = buildEngine("bar", {
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
    });
    const result = engine.export();

    expect(result.configuration).toEqual({
      "Program revenue": [{ currency: "EUR", program: "Ceramics", revenue: 80 }],
    });
  });

  it("compiles matrix points across the configured date window", () => {
    const result = buildEngine("matrix", {
      time: { field: "root[].day", timeUnit: "day", type: "temporal" },
      value: { aggregate: "sum", field: "root[].activity", type: "quantitative" },
    }, [
      { activity: 2, day: "2026-07-01T04:00:00Z" },
      { activity: 3, day: "2026-07-01T16:00:00Z" },
      { activity: 7, day: "2026-07-03T12:00:00Z" },
    ], { name: "Activity" }, {
      endDate: "2026-07-03T23:59:59Z",
      startDate: "2026-07-01T00:00:00Z",
    }).render();
    const dataset = result.configuration.data.datasets[0];

    expect(dataset.type).toBe("matrix");
    expect(dataset.label).toBe("Activity");
    expect(dataset.data.map((point) => ({ date: point.x, value: point.v }))).toEqual([
      { date: "2026-07-01", value: 5 },
      { date: "2026-07-02", value: 0 },
      { date: "2026-07-03", value: 7 },
    ]);
  });
});
