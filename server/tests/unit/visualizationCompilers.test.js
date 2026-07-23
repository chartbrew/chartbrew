import {
  afterEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine.js");
const { compileTabularExport } = require("../../visualization/compilers/tabularExport.js");

afterEach(() => {
  vi.useRealTimers();
});

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
    expect(result.configuration.data.datasets[0].backgroundColor).toHaveLength(2);
    expect(result.configuration.meta.categories.map((category) => category.label))
      .toEqual(["Direct", "Partner"]);
    expect(result.configuration.meta.categories.map((category) => category.color))
      .toEqual(result.configuration.data.datasets[0].backgroundColor);
    expect(result.configuration.data.datasets[0]).toEqual(expect.objectContaining({
      borderColor: "transparent",
      borderWidth: 2,
      hoverBorderWidth: 2,
      hoverOffset: 4,
      spacing: 0,
    }));
    expect(result.configuration.options.scales.x.display).toBe(false);
  });

  it("uses the same neutral arc treatment for pie charts", () => {
    const result = buildEngine("pie", {
      category: { field: "root[].channel", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    }, [
      { channel: "Direct", revenue: 55 },
      { channel: "Partner", revenue: 25 },
    ]).render();

    expect(result.configuration.data.datasets[0]).toEqual(expect.objectContaining({
      borderColor: "transparent",
      borderWidth: 0,
      hoverOffset: 4,
      spacing: 0,
    }));
  });

  it("keeps category slice colors stable and supports canonical overrides", () => {
    const data = [
      { channel: "Direct", revenue: 55 },
      { channel: "Partner", revenue: 25 },
    ];
    const automatic = buildEngine("doughnut", {
      category: { field: "root[].channel", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    }, data).render();
    const direct = automatic.configuration.meta.categories.find((category) => {
      return category.label === "Direct";
    });
    const overridden = buildEngine("doughnut", {
      category: { field: "root[].channel", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    }, [...data].reverse(), {
      style: { series: { [direct.id]: { color: "#112233" } } },
    }).render();
    const overriddenDirect = overridden.configuration.meta.categories.find((category) => {
      return category.label === "Direct";
    });

    expect(overriddenDirect.id).toBe(direct.id);
    expect(overriddenDirect.color).toBe("#112233");
    expect(overridden.configuration.data.datasets[0].backgroundColor[
      overridden.configuration.data.labels.indexOf("Direct")
    ]).toBe("#112233");
  });

  it("compiles radar fill from the series primary color and opacity", () => {
    const result = buildEngine("radar", {
      category: { field: "root[].team", type: "nominal" },
      value: { aggregate: "sum", field: "root[].score", type: "quantitative" },
    }, [
      { score: 80, team: "Sales" },
      { score: 65, team: "Marketing" },
      { score: 90, team: "Development" },
    ], {
      style: {
        color: "#2563EB",
        fill: true,
        fillColor: "#DB2777",
        fillOpacity: 0.2,
        multiFill: true,
      },
    }).render();

    expect(result.configuration.data.datasets[0]).toEqual(expect.objectContaining({
      backgroundColor: "rgba(37, 99, 235, 0.2)",
      borderColor: "#2563EB",
      datalabels: { display: false },
      fill: true,
    }));
    expect(result.configuration.data.datasets[0].backgroundColor).not.toBeInstanceOf(Array);
  });

  it.each(["bar", "line"])(
    "keeps %s formula values numeric and exposes the formula for display formatting",
    (mark) => {
      const formula = "${val / 100}";
      const result = buildEngine(mark, {
        category: { field: "root[].month", type: "nominal" },
        value: {
          aggregate: "sum",
          field: "root[].amount",
          formula,
          type: "quantitative",
        },
      }, [
        { amount: 1234, month: "Jan" },
        { amount: 5678, month: "Feb" },
      ], { name: "Revenue" }).render();

      expect(result.configuration.data.datasets[0]).toEqual(expect.objectContaining({
        data: [12.34, 56.78],
        formula,
      }));
    },
  );

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

  it("exports chart-as-shown rows with generated series as columns", () => {
    const engine = buildEngine("bar", {
      category: { field: "root[].program", type: "nominal" },
      breakdown: { field: "root[].level", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    }, [
      { program: "Ceramics", level: "Starter", revenue: 80 },
      { program: "Ceramics", level: "Advanced", revenue: 120 },
      { program: "Writing", level: "Starter", revenue: 40 },
    ], { name: "Program revenue" }, { name: "Revenue" });
    const result = engine.export({ mode: "shown" });

    expect(result.exportMode).toBe("shown");
    expect(result.configuration.Revenue).toEqual([
      { Category: "Ceramics", Advanced: 120, Starter: 80 },
      { Category: "Writing", Advanced: null, Starter: 40 },
    ]);
  });

  it("does not repeat one value-layer goal across generated breakdown series", () => {
    const result = buildEngine("bar", {
      category: { field: "root[].month", type: "nominal" },
      breakdown: { field: "root[].segment", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    }, [
      { month: "Jan", segment: "A", revenue: 80 },
      { month: "Jan", segment: "B", revenue: 120 },
    ], { goal: 500, name: "Revenue" }).render();

    expect(result.configuration.goals).toEqual([]);
  });

  it("keeps Other and hidden candidates in generated-series display metadata", () => {
    const result = buildEngine("bar", {
      category: { field: "root[].month", type: "nominal" },
      breakdown: { field: "root[].segment", type: "nominal" },
      value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
    }, [
      { month: "Jan", segment: "A", revenue: 80 },
      { month: "Jan", segment: "B", revenue: 60 },
      { month: "Jan", segment: "C", revenue: 10 },
    ], {
      options: { series: { includeOther: true, limit: 1 } },
    }).render();

    expect(result.configuration.meta.availableSeries.map((series) => series.label))
      .toEqual(["A", "Other", "B", "C"]);
  });

  it("exports shared source rows once when multiple value layers use one binding", () => {
    const result = compileTabularExport({
      conditionsOptions: [],
      datasets: [{
        options: { id: "shared", legend: "Financials" },
        data: [{ month: "Jan", revenue: 100, cost: 60 }],
      }],
      visualization: {
        version: 2,
        layers: ["revenue", "cost"].map((field) => ({
          id: field,
          name: field,
          bindingId: "shared",
          mark: "line",
          encoding: {
            category: { field: "root[].month", type: "nominal" },
            value: { field: `root[].${field}`, type: "quantitative" },
          },
        })),
      },
    });

    expect(Object.keys(result.configuration)).toEqual(["Financials"]);
    expect(result.configuration.Financials).toEqual([{ month: "Jan", revenue: 100, cost: 60 }]);
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

  it("compiles matrix points across the effective rolling date window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));

    const result = buildEngine("matrix", {
      time: { field: "root[].day", timeUnit: "day", type: "temporal" },
      value: { aggregate: "sum", field: "root[].activity", type: "quantitative" },
    }, [
      { activity: 2, day: "2026-07-16T12:00:00Z" },
      { activity: 5, day: "2026-07-20T12:00:00Z" },
      { activity: 7, day: "2026-07-23T12:00:00Z" },
    ], { name: "Activity" }, {
      currentEndDate: true,
      endDate: "2026-07-12T23:59:59Z",
      fixedStartDate: false,
      startDate: "2026-07-05T00:00:00Z",
      timeInterval: "day",
    }).render();
    const points = result.configuration.data.datasets[0].data;

    expect(points).toHaveLength(8);
    expect(points[0]).toEqual(expect.objectContaining({
      x: "2026-07-16",
      v: 2,
    }));
    expect(points[4]).toEqual(expect.objectContaining({
      x: "2026-07-20",
      v: 5,
    }));
    expect(points[7]).toEqual(expect.objectContaining({
      x: "2026-07-23",
      v: 7,
    }));
  });
});
