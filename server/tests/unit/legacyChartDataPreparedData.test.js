import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { VisualizationEngine } = require("../../visualization/VisualizationEngine");
const {
  legacyChartDataToPreparedData,
} = require("../../visualization/legacyChartDataToPreparedData");

function buildChart(type, options = {}) {
  return {
    ChartDatasetConfigs: [{
      Dataset: {},
      datasetColor: "#4285F4",
      id: 11,
      legend: options.legend || "Revenue",
      xAxis: "root[].month",
      yAxis: "root[].value",
      yAxisOperation: "sum",
      ...options.dataset,
    }],
    id: 42,
    name: options.name || "Revenue chart",
    type,
    ...options.chart,
  };
}

function compile(chart, preparedData) {
  return new VisualizationEngine({ chart, datasets: [] }).renderPrepared(preparedData);
}

describe("legacy chart data preparation", () => {
  it("converts stored chart labels and values without a connection request", () => {
    const chart = buildChart("line");
    const preparedData = legacyChartDataToPreparedData(chart, {
      chartData: {
        data: {
          datasets: [{ data: [10, 20], label: "Revenue" }],
          labels: ["Jan", "Feb"],
        },
      },
    });
    const compiled = compile(chart, preparedData);

    expect(preparedData.__legacyChartData).toBe(true);
    expect(compiled.configuration.dataset.source).toEqual([
      ["Jan", 10],
      ["Feb", 20],
    ]);
  });

  it("does not apply a stored chart formula twice", () => {
    const chart = buildChart("line", {
      dataset: { formula: "{val * 100}%" },
    });
    const preparedData = legacyChartDataToPreparedData(chart, {
      chartData: {
        data: {
          datasets: [{ data: [25], label: "Revenue" }],
          labels: ["Jan"],
        },
      },
    });
    const compiled = compile(chart, preparedData);

    expect(compiled.configuration.dataset.source[0][1]).toBe(25);
  });

  it("keeps KPI labels and values", () => {
    const chart = buildChart("kpi", { legend: "Visits" });
    const preparedData = legacyChartDataToPreparedData(chart, {
      chartData: {
        data: {
          datasets: [{ data: [5473], label: "Visits" }],
          labels: ["Value"],
        },
      },
    });
    const compiled = compile(chart, preparedData);

    expect(compiled.configuration.items[0]).toMatchObject({
      label: "Visits",
      valueNumber: 5473,
    });
  });

  it("restores nested table rows from stored table output", () => {
    const chart = buildChart("table", {
      legend: "Customers",
      dataset: { xAxis: "root[]" },
    });
    const preparedData = legacyChartDataToPreparedData(chart, {
      chartData: {
        Customers: {
          columns: [{
            Header: "profile",
            accessor: "profile",
            columns: [{ Header: "name", accessor: "profile?name" }],
          }],
          data: [{ "profile?name": "Ada" }],
        },
      },
    });
    const compiled = compile(chart, preparedData);

    expect(preparedData.results[0].rows).toEqual([{ profile: { name: "Ada" } }]);
    expect(compiled.configuration.Customers.data[0]["profile?name"]).toBe("Ada");
  });

  it("keeps already formatted table values", () => {
    const chart = buildChart("table", {
      legend: "Orders",
      dataset: {
        configuration: {
          columnsFormatting: {
            createdAt: { format: "D MMMM YYYY, HH:mm", type: "date" },
          },
        },
        xAxis: "root[]",
      },
    });
    const preparedData = legacyChartDataToPreparedData(chart, {
      chartData: {
        Orders: {
          columns: [{ Header: "createdAt", accessor: "createdAt" }],
          data: [{ createdAt: "2 March 2023, 23:36" }],
        },
      },
    });
    const compiled = compile(chart, preparedData);

    expect(compiled.configuration.Orders.data[0].createdAt).toBe("2 March 2023, 23:36");
  });

  it("converts stored matrix points", () => {
    const chart = buildChart("matrix");
    const preparedData = legacyChartDataToPreparedData(chart, {
      chartData: {
        data: {
          datasets: [{
            data: [{ v: 4, x: "2026-08-01", y: "Sat" }],
            label: "Revenue",
            type: "matrix",
          }],
        },
      },
    });
    const compiled = compile(chart, preparedData);

    expect(preparedData.results[0].rows[0]).toMatchObject({
      time: "2026-08-01",
      value: 4,
    });
    expect(compiled.configuration.dataset[0].source[0].value).toBe(4);
  });
});
