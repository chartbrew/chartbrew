import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");
const { assertVisualizationSpec } = require("../../visualization/spec");
const { applyChartCompatibilityUpdate, addBindingLayer } = require("../../visualization/compatibilityUpdates");
const { buildLegacyLayer } = require("../../visualization/legacyChartToVisualization");
const { renderEChartsSvg } = require("../../visualization/image/renderEChartsSvg");
const { resolveImageTheme } = require("../../visualization/image/imageTheme");
const echarts = require("echarts");

function layer(id, x = "x", y = "y") {
  return {
    id: `points-${id}`, bindingId: id, mark: "scatter", name: `Series ${id}`,
    encoding: {
      x: { field: `root[].${x}`, type: "quantitative", aggregate: "none" },
      y: { field: `root[].${y}`, type: "quantitative", aggregate: "none" },
    },
  };
}

function engine(data = []) {
  return new VisualizationEngine({
    chart: { id: 1, type: "scatter", name: "Scatter", visualization: {
      version: 2, status: "ready", layers: [layer(1)],
    } },
    datasets: [{ bindingId: 1, data }],
  });
}

describe("scatter data and rendering", () => {
  it("preserves repeated X values and duplicate points in separate dataset series and exports", () => {
    const chartEngine = engine([{ x: 10, y: 20 }, { x: 10, y: 30 }, { x: 10, y: 20 }, { x: 0, y: -5 }]);
    chartEngine.chart.visualization.layers.push(layer(2, "price", "sales"));
    chartEngine.datasets.push({ bindingId: 2, data: [{ price: 100, sales: 200 }] });
    chartEngine.chart.visualization.layers[0].style = { color: "#ff0000" };
    chartEngine.chart.visualization.layers[1].style = { color: "#0000ff" };
    const result = chartEngine.render();
    expect(result.configuration.series.map((series) => series.data.map((point) => point.value)))
      .toEqual([[[10, 20], [10, 30], [10, 20], [0, -5]], [[100, 200]]]);
    expect(result.configuration.series.map((series) => series.itemStyle.color)).toEqual(["#ff0000", "#0000ff"]);
    expect(result.metadata.series.map((series) => series.label)).toEqual(["Series 1", "Series 2"]);
    expect(result.metadata.metrics).toEqual([]);
    expect(result.tabularData).toEqual({
      "Series 1": [{ X: 10, Y: 20 }, { X: 10, Y: 30 }, { X: 10, Y: 20 }, { X: 0, Y: -5 }],
      "Series 2": [{ X: 100, Y: 200 }],
    });
    expect(chartEngine.export({ mode: "shown" }).configuration).toEqual(result.tabularData);
    const stored = JSON.parse(JSON.stringify(result.preparedData));
    expect(chartEngine.renderPrepared(stored).configuration).toEqual(result.configuration);
  });

  it("excludes invalid coordinate pairs without pairing values from different rows", () => {
    const result = engine([
      { x: "0", y: "-2.5" }, { x: 1, y: null }, { x: null, y: 2 },
      { x: false, y: 1 }, { x: [], y: 1 }, { x: {}, y: 1 },
      { x: " ", y: 1 }, { x: "wrong", y: 1 }, { x: Infinity, y: 1 },
    ]).render();
    expect(result.configuration.series[0].data.map((point) => point.value)).toEqual([[0, -2.5]]);
    expect(result.metadata.warnings).toContainEqual(expect.objectContaining({ code: "INVALID_SCATTER_COORDINATES", count: 8 }));
  });

  it("reads nested fields from one collection and applies row filters before plotting", () => {
    const chartEngine = engine();
    chartEngine.datasets[0].data = { items: [{ metrics: { x: 1, y: 2 } }, { metrics: { x: 1, y: 3 } }] };
    chartEngine.chart.visualization.layers[0].encoding = {
      x: { field: "root.items[].metrics.x" }, y: { field: "root.items[].metrics.y" },
    };
    expect(chartEngine.render().configuration.series[0].data.map((point) => point.value)).toEqual([[1, 2], [1, 3]]);
    chartEngine.chart.visualization.layers[0].transforms = [{ type: "filter", field: "root.items[].metrics.y", operator: "gt", value: 2 }];
    expect(chartEngine.render().configuration.series[0].data.map((point) => point.value)).toEqual([[1, 3]]);
    chartEngine.chart.visualization.layers[0].encoding.y.field = "root.other[].y";
    expect(() => chartEngine.render()).toThrow("different row collections");
  });

  it("renders empty and incomplete datasets without inventing points", () => {
    expect(engine().render().configuration.series[0].data).toEqual([]);
    const draft = engine([{ x: 1, y: 2 }]);
    draft.chart.visualization.status = "draft";
    delete draft.chart.visualization.layers[0].encoding.y;
    expect(draft.render().configuration.series[0].data).toEqual([]);
  });

  it("rejects aggregation, extra series per binding, temporal axes and point limits", () => {
    const visualization = engine().chart.visualization;
    visualization.layers.push({ ...layer(1), id: "extra" });
    expect(() => assertVisualizationSpec(visualization)).toThrow("one series per dataset row");
    visualization.layers.pop();
    visualization.layers[0].encoding.x.aggregate = "sum";
    expect(() => assertVisualizationSpec(visualization)).toThrow("without aggregation");
    visualization.layers[0].encoding.x.aggregate = "none";
    visualization.layers[0].encoding.x.type = "temporal";
    expect(() => assertVisualizationSpec(visualization)).toThrow("numeric X and Y");
    visualization.layers[0].encoding.x.type = "quantitative";
    visualization.layers[0].transforms = [{ type: "limit", count: 1 }];
    expect(() => assertVisualizationSpec(visualization)).toThrow("preserve all points");
  });

  it("restores other chart encodings and transforms after switching through scatter", () => {
    const original = { version: 2, layers: [{
      id: "a", bindingId: 1, mark: "bar", encoding: {
        category: { field: "root[].x", type: "quantitative" },
        value: { field: "root[].y", type: "quantitative", aggregate: "sum" },
      }, transforms: [{ type: "limit", count: 1 }],
    }] };
    const changed = applyChartCompatibilityUpdate(original, { type: "scatter" });
    expect(changed.layers[0].transforms).toEqual([]);
    expect(changed.layers[0].encoding).toEqual({
      x: { field: "root[].x", type: "quantitative" }, y: { field: "root[].y", type: "quantitative" },
    });
    const restored = applyChartCompatibilityUpdate(changed, { type: "bar" });
    expect(restored.layers[0].encoding).toEqual(original.layers[0].encoding);
    expect(restored.layers[0].transforms).toEqual(original.layers[0].transforms);
    expect(original.layers[0].transforms).toHaveLength(1);
    const added = addBindingLayer(changed, buildLegacyLayer({ type: "scatter" }, { id: 2, xAxis: "root[].cost", yAxis: "root[].profit", maxRecords: 1 }, 1));
    expect(added.layers[1].encoding).toEqual({ x: { field: "root[].cost", type: "quantitative" }, y: { field: "root[].profit", type: "quantitative" } });
    expect(added.layers[1].transforms).toEqual([]);
  });

  it("allows an incomplete scatter mapping to be saved while selecting fields", () => {
    const original = { version: 2, status: "ready", layers: [{
      id: "time", bindingId: 1, mark: "line", encoding: {
        time: { field: "root[].date", type: "temporal" },
        value: { field: "root[].sales", type: "quantitative" },
      },
    }] };
    const changed = applyChartCompatibilityUpdate(original, { type: "scatter", subType: "timeseries" });
    expect(changed.status).toBe("draft");
    expect(changed.layers[0].encoding).toEqual({ y: { field: "root[].sales", type: "quantitative" } });
    expect(assertVisualizationSpec(changed).status).toBe("draft");
    const restored = applyChartCompatibilityUpdate(changed, { type: "line" });
    expect(restored.status).toBe("ready");
    expect(restored.layers[0].encoding).toEqual(original.layers[0].encoding);
  });

  it("keeps every point and numeric axes across viewport sizes, themes and image output", () => {
    const result = engine([{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 2 }]).render();
    const instance = echarts.init(null, null, { renderer: "svg", ssr: true, width: 1000, height: 400 });
    try {
      instance.setOption(result.configuration);
      for (const [width, height] of [[1000, 400], [240, 150], [640, 360]]) {
        instance.resize({ width, height });
        expect(instance.getModel().getSeriesByIndex(0).getData().count()).toBe(3);
        expect(instance.getOption().xAxis[0].type).toBe("value");
        expect(instance.getOption().yAxis[0].type).toBe("value");
        expect(instance.renderToSVGString()).not.toContain("NaN");
      }
    } finally {
      instance.dispose();
    }
    for (const theme of ["light", "dark"]) {
      const svg = renderEChartsSvg({ chart: { type: "scatter" }, colors: resolveImageTheme({ theme }), height: 360, width: 640,
        preparedData: result.preparedData, visualization: result.visualization });
      expect(svg).toContain("<svg");
      expect(svg).not.toContain("NaN");
    }
  });
});
