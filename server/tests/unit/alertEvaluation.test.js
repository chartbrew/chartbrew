import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { legacyToVizConfig } = require("../../modules/visualizationV2/legacyToVizConfig.js");
const { runVisualizationV2 } = require("../../modules/visualizationV2/runtime.js");
const { findAlertTriggers } = require("../../modules/alerts/alertEvaluation.js");

describe("alertEvaluation", () => {
  it("evaluates threshold triggers against V2 timeseries chartData using the latest point for fresh alerts", () => {
    const fieldsMetadata = [
      {
        id: "created_at",
        legacyPath: "root[].created_at",
        type: "date",
        label: "Created At",
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
        id: 90,
        type: "line",
        mode: "chart",
      },
      dataset: {
        id: 190,
        xAxis: "root[].created_at",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        dateField: "root[].created_at",
        dateFormat: "YYYY-MM-DD",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_alert_timeseries",
        legend: "Revenue",
        vizVersion: 2,
      },
    });

    const runtimeResult = runVisualizationV2({
      chart: {
        id: 90,
        type: "line",
        mode: "chart",
        ChartDatasetConfigs: [{
          id: "cdc_alert_timeseries",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 190,
          name: "Revenue dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root[].created_at": "date",
            "root[].value": "number",
          },
          conditions: [],
          dateField: "root[].created_at",
          dateFormat: "YYYY-MM-DD",
        },
        data: [
          { created_at: "2026-03-01", value: 8 },
          { created_at: "2026-03-02", value: 16 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    const latestLabel = runtimeResult.configuration.data.labels[
      runtimeResult.configuration.data.labels.length - 1
    ];

    expect(findAlertTriggers({
      chartData: runtimeResult.configuration,
      datasetIndex: 0,
      alert: {
        type: "threshold_above",
        rules: {
          value: 10,
        },
        events: [],
      },
      isTimeseries: runtimeResult.isTimeseries,
    })).toEqual([{
      label: latestLabel,
      value: 16,
    }]);
  });

  it("evaluates threshold triggers against V2 categorical chartData across all labels", () => {
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
        id: 91,
        type: "bar",
        mode: "chart",
      },
      dataset: {
        id: 191,
        xAxis: "root[].step",
        yAxis: "root[].value",
        yAxisOperation: "sum",
        fieldsMetadata,
      },
      cdc: {
        id: "cdc_alert_categorical",
        legend: "Revenue",
        vizVersion: 2,
      },
    });

    const runtimeResult = runVisualizationV2({
      chart: {
        id: 91,
        type: "bar",
        mode: "chart",
        ChartDatasetConfigs: [{
          id: "cdc_alert_categorical",
          legend: "Revenue",
          vizVersion: 2,
          vizConfig: migration.vizConfig,
        }],
      },
      datasets: [{
        options: {
          id: 191,
          name: "Funnel dataset",
          fieldsMetadata,
          fieldsSchema: {
            "root[].step": "string",
            "root[].value": "number",
          },
          conditions: [],
        },
        data: [
          { step: "Signup", value: 12 },
          { step: "Activated", value: 25 },
          { step: "Paid", value: 40 },
        ],
      }],
      filters: [],
      variables: {},
      timezone: "UTC",
      skipParsing: false,
    });

    expect(findAlertTriggers({
      chartData: runtimeResult.configuration,
      datasetIndex: 0,
      alert: {
        type: "threshold_between",
        rules: {
          lower: 20,
          upper: 35,
        },
        events: [],
      },
      isTimeseries: runtimeResult.isTimeseries,
    })).toEqual([{
      label: "Activated",
      value: 25,
    }]);
  });
});
