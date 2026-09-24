import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");
const { buildAiVisualization } = require("../../visualization/aiVisualization");
const { datasetDefaults, fingerprint, applyChartLimit } = require("../../modules/chartCreationDefaults");

describe("inline chart defaults", () => {
  const fields = { "root[].date": "date", "root[].visits": "number", "root[].rate": "number" };

  it("keeps the saved measure and aggregation instead of counting numeric values", () => {
    const result = datasetDefaults({ xAxis: "root[].date", yAxis: "root[].visits", yAxisOperation: "none" }, fields);
    expect(result).toMatchObject({ type: "line", yAxisOperation: "none", dateField: "root[].date" });
  });

  it("asks for a missing metric and does not guess an aggregation", () => {
    expect(datasetDefaults({}, fields).field).toBe("yAxis");
    expect(datasetDefaults({}, fields, { yAxis: "root[].rate" }).field).toBe("yAxisOperation");
    expect(datasetDefaults({}, fields, { yAxis: "root[].rate", yAxisOperation: "avg" })).toMatchObject({ type: "line", yAxisOperation: "avg" });
  });

  it("uses the only date field and avoids reducing ungrouped rows to the last value", () => {
    expect(datasetDefaults({ yAxis: "root[].visits", yAxisOperation: "none" }, fields, {}, 30)).toMatchObject({ type: "line", xAxis: "root[].date" });
    expect(datasetDefaults({ yAxis: "root[].visits", yAxisOperation: "none" }, { "root[].visits": "number" }, {}, 30).type).toBe("table");
  });

  it("puts requested limits in the renderer's transforms", () => {
    const chart = { layers: [{ transforms: [{ type: "limit", count: 10 }] }] };
    const limited = applyChartLimit(chart, { maxRecords: 5, sort: "desc" });
    expect(limited.layers[0].transforms).toEqual([{ type: "sort", role: "value", direction: "desc" }, { type: "limit", count: 5 }]);
    const visualization = buildAiVisualization({ bindingId: "one", chart: { type: "bar" }, cdc: { xAxis: "root[].country", yAxis: "root[].visits", yAxisOperation: "none" } });
    const rendered = new VisualizationEngine({ chart: { type: "bar", visualization: applyChartLimit(visualization, { maxRecords: 2, sort: "desc" }) },
      datasets: [{ data: [{ country: "A", visits: 1 }, { country: "B", visits: 2 }, { country: "C", visits: 3 }], options: { id: "one" } }],
    }).render();
    expect(rendered.preparedData.results[0].rows).toHaveLength(2);
    expect(chart.layers[0].transforms).toEqual([{ type: "limit", count: 10 }]);
    expect(() => applyChartLimit(chart, { maxRecords: -1 })).toThrow("Invalid chart limit");
    expect(fingerprint(new Date("2026-01-01"))).not.toBe(fingerprint(new Date("2026-02-01")));
  });

  it("rejects stale bindings and hashes equivalent input consistently", () => {
    expect(datasetDefaults({ yAxis: "root[].deleted" }, fields).field).toBe("yAxis");
    expect(fingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(fingerprint({ a: { c: 3, d: 4 }, b: 2 }));
    expect(fingerprint({ a: [1, 2] })).not.toBe(fingerprint({ a: [2, 1] }));
  });
});
