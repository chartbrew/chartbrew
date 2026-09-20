import { describe, expect, it } from "vitest";
import { createRequire } from "module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine.js");

function readFixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/visualization/${name}`, import.meta.url), "utf8"));
}

function buildChart(data) {
  return {
    chart: {
      id: 1,
      type: "bar",
      displayLegend: true,
      includeZeros: false,
      mode: "chart",
      visualization: {
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
      },
    },
    datasets: [{ options: { id: "cdc-income" }, data }],
  };
}

describe("Chart.js cartesian visualization compiler", () => {
  it.each([
    ["line", "vertical"],
    ["bar", "vertical"],
    ["bar", "horizontal"],
  ])("applies and clears value limits for %s %s charts", (mark, orientation) => {
    const input = buildChart(readFixture("exam-income-long.json"));
    Object.assign(input.chart.visualization.layers[0], { mark, orientation });
    input.chart.minValue = 10;
    input.chart.maxValue = 500;
    const valueAxis = orientation === "horizontal" ? "x" : "y";
    const categoryAxis = valueAxis === "x" ? "y" : "x";
    const renderScales = () => new VisualizationEngine(input).render().configuration.options.scales;

    expect(renderScales()[valueAxis]).toMatchObject({ min: 10, max: 500, beginAtZero: false });

    for (const [minValue, maxValue] of [[0, 100], [-100, 0], [25, 75]]) {
      input.chart.visualization.settings = { minValue, maxValue };
      const scales = renderScales();
      expect(scales[valueAxis]).toMatchObject({ min: minValue, max: maxValue, beginAtZero: false });
      expect(scales[categoryAxis].min).toBeUndefined();
      expect(scales[categoryAxis].max).toBeUndefined();
    }

    input.chart.visualization.settings = { minValue: null, maxValue: null };
    expect(renderScales()[valueAxis].min).toBeUndefined();
    expect(renderScales()[valueAxis].max).toBeUndefined();
    expect(renderScales()[valueAxis].beginAtZero).toBe(true);
  });

  it("compiles one binding and one breakdown into multiple stacked datasets", () => {
    const input = buildChart(readFixture("exam-income-long.json"));
    const result = new VisualizationEngine(input).render();
    const datasets = result.configuration.data.datasets;

    expect(result.adapted).toBe(false);
    expect(result.configuration.data.labels).toEqual(["Ceramics", "Photography", "Writing"]);
    expect(datasets.map((dataset) => dataset.label)).toEqual([
      "Advanced",
      "Starter",
      "Unclassified",
    ]);
    expect(datasets[0].data).toEqual([165, 140, null]);
    expect(datasets[1].data).toEqual([180, 125, null]);
    expect(datasets[2].data).toEqual([null, null, 120]);
    expect(result.configuration.options.scales.x.stacked).toBe(true);
    expect(result.configuration.options.scales.y.stacked).toBe(true);
    expect(result.configuration.meta.series).toHaveLength(3);
    expect(result.configuration.meta.series.every((series) => {
      return series.bindingId === "cdc-income" && series.layerId === "income";
    })).toBe(true);
  });

  it("assigns the same series colors when input rows are reordered", () => {
    const data = readFixture("exam-income-long.json");
    const normal = new VisualizationEngine(buildChart(data)).render();
    const reversed = new VisualizationEngine(buildChart({ rows: [...data.rows].reverse() })).render();
    const normalColors = Object.fromEntries(normal.configuration.data.datasets.map((dataset) => {
      return [dataset.label, dataset.backgroundColor];
    }));
    const reversedColors = Object.fromEntries(reversed.configuration.data.datasets.map((dataset) => {
      return [dataset.label, dataset.backgroundColor];
    }));

    expect(reversedColors).toEqual(normalColors);
  });

  it("uses the canonical legend setting for Cartesian charts", () => {
    const input = buildChart(readFixture("exam-income-long.json"));
    input.chart.displayLegend = true;
    input.chart.visualization.settings = {
      legend: { visible: false },
    };

    const result = new VisualizationEngine(input).render();

    expect(result.configuration.options.plugins.legend.display).toBe(false);
  });

  it("can render sparse category and series combinations as zero", () => {
    const input = buildChart(readFixture("exam-income-long.json"));
    input.chart.visualization.settings = {
      missingValues: { policy: "zero" },
    };

    const result = new VisualizationEngine(input).render();
    const byLabel = Object.fromEntries(result.configuration.data.datasets.map((dataset) => {
      return [dataset.label, dataset.data];
    }));

    expect(byLabel.Advanced).toEqual([165, 140, 0]);
    expect(byLabel.Unclassified).toEqual([0, 0, 120]);
  });

  it("assigns palette colors to breakdown series and supports stable overrides", () => {
    const input = buildChart(readFixture("exam-income-long.json"));
    input.chart.visualization.layers[0].style = {
      color: "#123456",
      fillColor: "#123456",
    };
    const automatic = new VisualizationEngine(input).render();
    const automaticColors = automatic.configuration.data.datasets.map((dataset) => {
      return dataset.backgroundColor;
    });

    expect(new Set(automaticColors).size).toBe(3);
    expect(automaticColors).not.toContain("#123456");
    expect(automatic.configuration.meta.series.map((series) => series.color))
      .toEqual(automaticColors);

    const firstSeries = automatic.configuration.meta.series[0];
    input.chart.visualization.layers[0].style.series = {
      [firstSeries.id]: {
        color: "#112233",
        fillColor: "#112233",
      },
    };
    const overridden = new VisualizationEngine(input).render();

    expect(overridden.configuration.data.datasets[0].backgroundColor).toBe("#112233");
    expect(overridden.configuration.meta.series[0].color).toBe("#112233");
  });

  it("derives every fill from its series color with one shared opacity", () => {
    const input = buildChart(readFixture("exam-income-long.json"));
    input.chart.visualization.layers[0].style = {
      fill: true,
      fillOpacity: 0.35,
    };
    const automatic = new VisualizationEngine(input).render();
    const firstSeries = automatic.configuration.meta.series[0];

    input.chart.visualization.layers[0].style.series = {
      [firstSeries.id]: {
        color: "#112233",
        fillColor: "#FFFFFF",
      },
    };
    const overridden = new VisualizationEngine(input).render();
    const datasets = overridden.configuration.data.datasets;

    expect(datasets[0].borderColor).toBe("#112233");
    expect(datasets[0].backgroundColor).toBe("rgba(17, 34, 51, 0.35)");
    expect(datasets.every((dataset) => dataset.backgroundColor.endsWith(", 0.35)")))
      .toBe(true);
    expect(new Set(datasets.map((dataset) => dataset.backgroundColor)).size).toBe(3);
  });

  it("carries every accumulated breakdown series across sparse dates", () => {
    const input = {
      chart: {
        id: 3,
        type: "bar",
        displayLegend: true,
        includeZeros: false,
        mode: "chart",
        visualization: {
          version: 2,
          layers: [{
            id: "running-segments",
            bindingId: "cdc-running-segments",
            mark: "bar",
            encoding: {
              time: { field: "root[].date", timeUnit: "day", type: "temporal" },
              value: { field: "root[].value", type: "quantitative", aggregate: "sum" },
              breakdown: { field: "root[].segment", type: "nominal" },
            },
            transforms: [{ operation: "cumulativeSum", role: "value", type: "window" }],
          }],
        },
      },
      datasets: [{
        options: { id: "cdc-running-segments" },
        data: [
          { date: "2026-01-01", segment: "Enterprise", value: 10 },
          { date: "2026-01-01", segment: "Self-serve", value: 1 },
          { date: "2026-02-01", segment: "Enterprise", value: 20 },
          { date: "2026-03-01", segment: "Self-serve", value: 3 },
        ],
      }],
    };
    const result = new VisualizationEngine(input).render();
    const byLabel = Object.fromEntries(result.configuration.data.datasets.map((dataset) => {
      return [dataset.label, dataset.data];
    }));

    expect(byLabel.Enterprise).toEqual([10, 30, 30]);
    expect(byLabel["Self-serve"]).toEqual([1, 1, 4]);
  });

  it("adapts an unmigrated legacy chart before compiling it", () => {
    const chart = {
      id: 2,
      type: "bar",
      displayLegend: true,
      includeZeros: false,
      ChartDatasetConfigs: [{
        id: "cdc-legacy",
        dataset_id: 10,
        xAxis: "root[].category",
        yAxis: "root[].amount",
        yAxisOperation: "sum",
        legend: "Amount",
        fill: true,
        fillColor: "#123456",
        Dataset: { id: 10, name: "Orders" },
      }],
    };
    const result = new VisualizationEngine({
      chart,
      datasets: [{
        options: { id: "cdc-legacy" },
        data: [
          { category: "One", amount: 2 },
          { category: "One", amount: 3 },
          { category: "Two", amount: 4 },
        ],
      }],
    }).render();

    expect(result.adapted).toBe(true);
    expect(result.configuration.data.labels).toEqual(["One", "Two"]);
    expect(result.configuration.data.datasets[0].data).toEqual([5, 4]);
    expect(result.configuration.data.datasets[0].backgroundColor).toBe("#123456");
  });
});
