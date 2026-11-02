import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  findThresholdMatches,
  getAlertSeries,
  removePreviouslyTriggeredItems,
} = require("../../modules/alerts/alertSeries.js");

function buildChart(overrides = {}) {
  return {
    isTimeseries: false,
    visualization: {
      settings: {},
      layers: [{
        bindingId: "cdc-revenue",
        encoding: {
          breakdown: { field: "segment" },
          category: { field: "month" },
          value: { field: "value" },
        },
        id: "revenue",
        mark: "bar",
        name: "Revenue",
      }, {
        bindingId: "cdc-other",
        encoding: {
          category: { field: "month" },
          value: { field: "value" },
        },
        id: "other",
        mark: "bar",
        name: "Other",
      }],
    },
    ...overrides,
  };
}

function buildPreparedData() {
  return {
    frameVersion: 1,
    generatedAt: "2026-08-19T00:00:00.000Z",
    results: [{
      bindingId: "cdc-revenue",
      fields: [
        { key: "category", role: "dimension", type: "nominal" },
        { key: "value", role: "measure", type: "quantitative" },
        { key: "breakdown", role: "dimension", type: "nominal" },
      ],
      id: "revenue",
      mark: "bar",
      rows: [{
        breakdown: "Enterprise",
        category: "January",
        seriesId: "series-enterprise",
        value: 120,
      }, {
        breakdown: "Enterprise",
        category: "February",
        seriesId: "series-enterprise",
        value: 140,
      }, {
        breakdown: "Self-serve",
        category: "January",
        seriesId: "series-self-serve",
        value: null,
      }, {
        breakdown: "Self-serve",
        category: "February",
        seriesId: "series-self-serve",
        value: 90,
      }],
      series: [{ id: "series-enterprise", label: "Enterprise" }, {
        id: "series-self-serve",
        label: "Self-serve",
      }],
    }, {
      bindingId: "cdc-other",
      fields: [
        { key: "category", role: "dimension", type: "nominal" },
        { key: "value", role: "measure", type: "quantitative" },
      ],
      id: "other",
      mark: "bar",
      rows: [{ category: "January", seriesId: "series-other", value: 500 }, {
        category: "February", seriesId: "series-other", value: 600,
      }],
      series: [{ id: "series-other", label: "Other dataset" }],
    }],
    timezone: "UTC",
    version: 1,
    warnings: [],
  };
}

function getSeries(chart, bindingId) {
  return getAlertSeries(
    buildPreparedData(),
    chart.visualization,
    bindingId,
    { chart }
  );
}

describe("generated-series alerts", () => {
  it("finds every rendered series produced by one dataset binding", () => {
    const chart = buildChart();
    const series = getSeries(chart, "cdc-revenue");

    expect(series.map((item) => item.seriesId)).toEqual([
      "series-enterprise",
      "series-self-serve",
    ]);
  });

  it("collects matching values from every series and ignores sparse nulls", () => {
    const chart = buildChart();
    const series = getSeries(chart, "cdc-revenue");
    const matches = findThresholdMatches(chart, {
      events: [],
      rules: { value: 100 },
      type: "threshold_above",
    }, series);

    expect(matches).toEqual([{
      label: "January",
      layerId: "revenue",
      seriesId: "series-enterprise",
      seriesLabel: "Enterprise",
      value: 120,
    }, {
      label: "February",
      layerId: "revenue",
      seriesId: "series-enterprise",
      seriesLabel: "Enterprise",
      value: 140,
    }]);
  });

  it("does not treat a sparse null as a value below the threshold", () => {
    const chart = buildChart();
    const series = getSeries(chart, "cdc-revenue");
    const matches = findThresholdMatches(chart, {
      events: [],
      rules: { value: 100 },
      type: "threshold_below",
    }, series);

    expect(matches.map((item) => [item.seriesLabel, item.label, item.value])).toEqual([
      ["Self-serve", "February", 90],
    ]);
  });

  it("checks only the latest domain point for a time-series alert", () => {
    const chart = buildChart({ isTimeseries: true });
    const series = getSeries(chart, "cdc-revenue");
    const matches = findThresholdMatches(chart, {
      events: [{ trigger: [{ label: "January", seriesId: "series-enterprise" }] }],
      rules: { value: 80 },
      type: "threshold_above",
    }, series);

    expect(matches.map((item) => [item.seriesLabel, item.label, item.value])).toEqual([
      ["Enterprise", "February", 140],
      ["Self-serve", "February", 90],
    ]);
  });

  it("deduplicates time-series events by series and point identity", () => {
    const chart = buildChart({ isTimeseries: true });
    const alert = {
      events: [{
        trigger: [{
          label: "February",
          seriesId: "series-enterprise",
        }],
      }],
    };
    const matches = [{
      label: "February",
      seriesId: "series-enterprise",
    }, {
      label: "February",
      seriesId: "series-self-serve",
    }];

    expect(removePreviouslyTriggeredItems(chart, alert, matches)).toEqual([{
      label: "February",
      seriesId: "series-self-serve",
    }]);
  });

  it("does not use a renderer payload when PreparedData is unavailable", () => {
    const chart = buildChart({
      chartData: {
        data: {
          labels: ["Total"],
          datasets: [{ label: "Revenue", data: [120] }],
        },
      },
    });

    expect(getAlertSeries(null, chart.visualization, "cdc-revenue", { chart })).toEqual([]);
  });
});
