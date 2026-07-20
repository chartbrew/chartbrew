import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { buildVisualizationFrame } = require("../../visualization/frameBuilder.js");

function readFixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/visualization/${name}`, import.meta.url), "utf8"));
}

function getSeriesIdsByLabel(frame) {
  return Object.fromEntries(frame.layers[0].series.map((series) => [series.label, series.id]));
}

describe("visualization frame builder", () => {
  it("creates sparse stacked series from one long-form dataset binding", () => {
    const data = readFixture("exam-income-long.json");
    const visualization = {
      version: 2,
      layers: [{
        id: "income",
        bindingId: "cdc-income",
        mark: "bar",
        encoding: {
          category: { field: "root.rows[].program", type: "nominal" },
          value: { field: "root.rows[].revenue", type: "quantitative", aggregate: "sum" },
          breakdown: {
            field: "root.rows[].level",
            type: "nominal",
            nullPolicy: "label",
            nullLabel: "Unclassified",
          },
        },
        stack: "normal",
        transforms: [{
          type: "filter",
          field: "root.rows[].currency",
          operator: "equals",
          value: "nzd",
        }],
      }],
    };

    const frame = buildVisualizationFrame({
      visualization,
      datasets: [{ options: { id: "cdc-income" }, data }],
    });
    const layer = frame.layers[0];
    const ceramicsStarter = layer.rows.find((row) => {
      return row.category === "Ceramics" && row.breakdown === "Starter";
    });

    expect(layer.stats).toEqual({ inputRows: 7, filteredRows: 6, outputRows: 5 });
    expect(ceramicsStarter.value).toBe(180);
    expect(layer.series.map((series) => series.label)).toEqual([
      "Advanced",
      "Starter",
      "Unclassified",
    ]);
    expect(layer.rows).toHaveLength(5);
    expect(layer.rows.every((row) => row.__seriesId)).toBe(true);
  });

  it("keeps generated series identities stable when source row order changes", () => {
    const data = readFixture("exam-income-long.json");
    const visualization = {
      version: 2,
      layers: [{
        id: "income",
        bindingId: "cdc-income",
        mark: "bar",
        encoding: {
          category: { field: "root.rows[].program", type: "nominal" },
          value: { field: "root.rows[].revenue", type: "quantitative", aggregate: "sum" },
          breakdown: {
            field: "root.rows[].level",
            type: "nominal",
            nullPolicy: "label",
            nullLabel: "Unclassified",
          },
        },
      }],
    };
    const normal = buildVisualizationFrame({
      visualization,
      datasets: [{ options: { id: "cdc-income" }, data }],
    });
    const reversed = buildVisualizationFrame({
      visualization,
      datasets: [{ options: { id: "cdc-income" }, data: { rows: [...data.rows].reverse() } }],
    });

    expect(getSeriesIdsByLabel(reversed)).toEqual(getSeriesIdsByLabel(normal));
  });

  it("supports a scalar KPI without category or axis encodings", () => {
    const data = readFixture("scalar-metric.json");
    const frame = buildVisualizationFrame({
      visualization: {
        version: 2,
        layers: [{
          id: "total",
          bindingId: "cdc-total",
          mark: "kpi",
          encoding: {
            value: { field: "root.total", type: "quantitative", aggregate: "none" },
          },
        }],
      },
      datasets: [{ options: { id: "cdc-total" }, data }],
    });

    expect(frame.layers[0].rows).toEqual([{
      __seriesId: expect.any(String),
      __sourceRowCount: 1,
      value: 512,
    }]);
  });

  it("supports nested API collections", () => {
    const data = readFixture("nested-orders.json");
    const frame = buildVisualizationFrame({
      visualization: {
        version: 2,
        layers: [{
          id: "orders",
          bindingId: "cdc-orders",
          mark: "bar",
          encoding: {
            category: { field: "root.data.items[].channel", type: "nominal" },
            value: { field: "root.data.items[].total", type: "quantitative", aggregate: "sum" },
            breakdown: { field: "root.data.items[].region", type: "nominal" },
          },
        }],
      },
      datasets: [{ options: { id: "cdc-orders" }, data }],
    });

    expect(frame.layers[0].rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "Direct", breakdown: "East", value: 80 }),
      expect.objectContaining({ category: "Direct", breakdown: "West", value: 95 }),
    ]));
  });

  it("supports multiple visual layers sharing one wide-form binding", () => {
    const data = readFixture("wide-metrics.json");
    const frame = buildVisualizationFrame({
      visualization: {
        version: 2,
        layers: ["revenue", "cost"].map((metric) => ({
          id: metric,
          name: metric === "revenue" ? "Revenue" : "Cost",
          bindingId: "cdc-finance",
          mark: "line",
          encoding: {
            time: { field: "root[].month", type: "temporal" },
            value: { field: `root[].${metric}`, type: "quantitative", aggregate: "none" },
          },
        })),
      },
      datasets: [{ options: { id: "cdc-finance" }, data }],
    });

    expect(frame.layers).toHaveLength(2);
    expect(frame.layers[0].rows.map((row) => row.value)).toEqual([240, 310, 285]);
    expect(frame.layers[1].rows.map((row) => row.value)).toEqual([110, 145, 125]);
  });

  it("preserves sparse pre-aggregated rows without inventing zero-value combinations", () => {
    const data = readFixture("preaggregated-sparse.json");
    const frame = buildVisualizationFrame({
      visualization: {
        version: 2,
        layers: [{
          id: "segments",
          bindingId: "cdc-segments",
          mark: "line",
          encoding: {
            time: { field: "root[].period", type: "temporal" },
            value: { field: "root[].total", type: "quantitative", aggregate: "none" },
            breakdown: { field: "root[].segment", type: "nominal" },
          },
        }],
      },
      datasets: [{ options: { id: "cdc-segments" }, data }],
    });

    expect(frame.layers[0].rows).toHaveLength(4);
    expect(frame.layers[0].rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ time: expect.any(Number), breakdown: "New", value: 23 }),
      expect.objectContaining({ time: expect.any(Number), breakdown: "Returning", value: 17 }),
    ]));
  });

  it("builds independent layers from multiple data bindings", () => {
    const data = readFixture("multi-binding.json");
    const frame = buildVisualizationFrame({
      visualization: {
        version: 2,
        layers: [{
          id: "actual",
          name: "Actual",
          bindingId: "cdc-actual",
          mark: "line",
          encoding: {
            time: { field: "root[].month", type: "temporal" },
            value: { field: "root[].value", type: "quantitative", aggregate: "none" },
          },
        }, {
          id: "target",
          name: "Target",
          bindingId: "cdc-target",
          mark: "line",
          encoding: {
            time: { field: "root[].month", type: "temporal" },
            value: { field: "root[].value", type: "quantitative", aggregate: "none" },
          },
        }],
      },
      datasets: [
        { options: { id: "cdc-actual" }, data: data.actual },
        { options: { id: "cdc-target" }, data: data.target },
      ],
    });

    expect(frame.layers.map((layer) => layer.bindingId)).toEqual(["cdc-actual", "cdc-target"]);
    expect(frame.layers[0].rows.map((row) => row.value)).toEqual([80, 92]);
    expect(frame.layers[1].rows.map((row) => row.value)).toEqual([85, 90]);
  });

  it("sorts time rows before calculating cumulative values", () => {
    const frame = buildVisualizationFrame({
      visualization: {
        version: 2,
        layers: [{
          id: "running",
          bindingId: "cdc-running",
          mark: "line",
          encoding: {
            time: { field: "root[].month", timeUnit: "month", type: "temporal" },
            value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
          },
          transforms: [{ operation: "cumulativeSum", role: "value", type: "window" }],
        }],
      },
      datasets: [{
        options: { id: "cdc-running" },
        data: [
          { month: "2026-03-01", revenue: 30 },
          { month: "2026-01-01", revenue: 10 },
          { month: "2026-02-01", revenue: 20 },
        ],
      }],
    });

    expect(frame.layers[0].rows.map((row) => row.value)).toEqual([10, 30, 60]);
  });

  it("calculates cumulative values independently for every breakdown series", () => {
    const frame = buildVisualizationFrame({
      visualization: {
        version: 2,
        layers: [{
          id: "running-segments",
          bindingId: "cdc-running-segments",
          mark: "bar",
          encoding: {
            time: { field: "root[].date", timeUnit: "day", type: "temporal" },
            value: { aggregate: "sum", field: "root[].value", type: "quantitative" },
            breakdown: { field: "root[].segment", type: "nominal" },
          },
          transforms: [{ operation: "cumulativeSum", role: "value", type: "window" }],
        }],
      },
      datasets: [{
        options: { id: "cdc-running-segments" },
        data: [
          { date: "2026-02-01", segment: "Enterprise", value: 20 },
          { date: "2026-01-01", segment: "Self-serve", value: 1 },
          { date: "2026-01-01", segment: "Enterprise", value: 10 },
          { date: "2026-03-01", segment: "Self-serve", value: 3 },
          { date: "2026-02-01", segment: "Self-serve", value: 2 },
        ],
      }],
    });
    const rows = frame.layers[0].rows;

    expect(rows.filter((row) => row.breakdown === "Enterprise").map((row) => row.value))
      .toEqual([10, 30]);
    expect(rows.filter((row) => row.breakdown === "Self-serve").map((row) => row.value))
      .toEqual([1, 3, 6]);
  });

  it("warns about high-cardinality breakdowns without densifying the frame", () => {
    const frame = buildVisualizationFrame({
      visualization: {
        version: 2,
        layers: [{
          id: "segments",
          bindingId: "cdc-segments",
          mark: "bar",
          encoding: {
            category: { field: "root[].category", type: "nominal" },
            value: { field: "root[].value", type: "quantitative", aggregate: "sum" },
            breakdown: { field: "root[].segment", type: "nominal" },
          },
        }],
      },
      datasets: [{
        options: { id: "cdc-segments" },
        data: [
          { category: "A", segment: "One", value: 1 },
          { category: "B", segment: "Two", value: 2 },
          { category: "C", segment: "Three", value: 3 },
        ],
      }],
    }, { cardinalityWarning: 2 });

    expect(frame.layers[0].rows).toHaveLength(3);
    expect(frame.warnings).toEqual([expect.objectContaining({
      code: "HIGH_BREAKDOWN_CARDINALITY",
      count: 3,
      layerId: "segments",
    })]);
  });
});
