import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { legacyToVizConfig } = require("../../modules/visualizationV2/legacyToVizConfig.js");
const { runVisualizationV2 } = require("../../modules/visualizationV2/runtime.js");
const getEmbeddedChartData = require("../../modules/getEmbeddedChartData.js");

describe("getEmbeddedChartData", () => {
  it("preserves V2-generated chartData for embedded charts", () => {
    const fieldsMetadata = [
      {
        id: "step",
        legacyPath: "root[].step",
        type: "string",
        label: "Step",
      },
      {
        id: "value",
        legacyPath: "root[].value",
        type: "number",
        label: "Value",
      },
    ];

    const migration = legacyToVizConfig({
      chart: {
        id: 101,
        type: "bar",
        mode: "chart",
      },
      dataset: {
        id: 201,
        xAxis: "root[].step",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_embed_runtime",
        legend: "Revenue",
      },
    });

    const runtimeResult = runVisualizationV2({
      chart: {
        id: 101,
        name: "Embedded V2 chart",
        type: "bar",
        mode: "chart",
        showGrowth: false,
        ChartDatasetConfigs: [{
          id: "cdc_embed_runtime",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 201,
          name: "Revenue dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root[].step": "string",
            "root[].value": "number",
          },
          conditions: [],
        },
        data: [
          { step: "Signup", value: 10 },
          { step: "Activated", value: 20 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    const embeddedChartData = getEmbeddedChartData({
      id: 101,
      name: "Embedded V2 chart",
      type: "bar",
      mode: "chart",
      chartDataUpdated: new Date("2026-03-19T10:00:00.000Z"),
      chartData: runtimeResult.configuration,
      ChartDatasetConfigs: [{
        id: "cdc_embed_runtime",
        legend: "Revenue",
        vizVersion: 2,
        vizConfig: migration.vizConfig,
      }],
      showGrowth: false,
    }, {
      showBranding: false,
      allowReportExport: true,
      allowReportRefresh: true,
    });

    expect(embeddedChartData.chartData).toEqual(runtimeResult.configuration);
    expect(embeddedChartData.chartData.data.labels).toEqual(["Signup", "Activated"]);
    expect(embeddedChartData.chartData.data.datasets[0].data).toEqual([10, 20]);
    expect(embeddedChartData.ChartDatasetConfigs[0].vizVersion).toBe(2);
  });
});
