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
