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
    chartData: {
      data: {
        labels: ["January", "February"],
        datasets: [{
          data: [120, 140],
          label: "Enterprise",
        }, {
          data: [null, 90],
          label: "Self-serve",
        }, {
          data: [500, 600],
          label: "Other dataset",
        }],
      },
      meta: {
        series: [{
          bindingId: "cdc-revenue",
          id: "series-enterprise",
          label: "Enterprise",
          layerId: "revenue",
        }, {
          bindingId: "cdc-revenue",
          id: "series-self-serve",
          label: "Self-serve",
          layerId: "revenue",
        }, {
          bindingId: "cdc-other",
          id: "series-other",
          label: "Other dataset",
          layerId: "other",
        }],
      },
    },
    isTimeseries: false,
    visualization: {
      layers: [{
        bindingId: "cdc-revenue",
        id: "revenue",
        name: "Revenue",
      }, {
        bindingId: "cdc-other",
        id: "other",
        name: "Other",
      }],
    },
    ...overrides,
  };
}

describe("generated-series alerts", () => {
  it("finds every rendered series produced by one dataset binding", () => {
    const series = getAlertSeries(buildChart(), "cdc-revenue", 0);

    expect(series.map((item) => item.seriesId)).toEqual([
      "series-enterprise",
      "series-self-serve",
    ]);
  });

  it("collects matching values from every series and ignores sparse nulls", () => {
    const chart = buildChart();
    const series = getAlertSeries(chart, "cdc-revenue", 0);
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
    const series = getAlertSeries(chart, "cdc-revenue", 0);
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
    const series = getAlertSeries(chart, "cdc-revenue", 0);
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

  it("falls back to the legacy CDC dataset position when metadata is unavailable", () => {
    const chart = buildChart({
      chartData: {
        data: {
          labels: ["Total"],
          datasets: [{ label: "Revenue", data: [120] }],
        },
      },
      visualization: null,
    });

    expect(getAlertSeries(chart, "cdc-revenue", 0)[0]).toMatchObject({
      datasetIndex: 0,
      seriesLabel: "Revenue",
    });
  });
});
