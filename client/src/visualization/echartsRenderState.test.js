import assert from "node:assert/strict";
import test from "node:test";

import {
  getEChartsPreset,
  isCompatibleEChartsRender,
  selectEChartsRender,
} from "./echartsRenderState.js";

test("distinguishes pie and doughnut ECharts options", () => {
  assert.equal(getEChartsPreset({ series: [{ radius: "70%", type: "pie" }] }), "pie");
  assert.equal(getEChartsPreset({ series: [{ radius: ["46%", "70%"], type: "pie" }] }), "doughnut");
});

test("distinguishes vertical and horizontal bar ECharts options", () => {
  assert.equal(getEChartsPreset({
    series: [{ type: "bar" }],
    xAxis: { type: "category" },
    yAxis: { type: "value" },
  }), "bar");
  assert.equal(getEChartsPreset({
    series: [{ type: "bar" }],
    xAxis: [{ type: "value" }],
    yAxis: [{ type: "category" }],
  }), "horizontalBar");
});

test("rejects a stale render after the chart type changes", () => {
  const render = {
    configuration: { series: [{ radius: "70%", type: "pie" }] },
    renderer: "echarts",
  };

  assert.equal(isCompatibleEChartsRender("pie", render), true);
  assert.equal(isCompatibleEChartsRender("doughnut", render), false);
});

test("keeps the previous ECharts frame during a renderer transition", () => {
  const previous = {
    configuration: { series: [{ radius: "70%", type: "pie" }] },
    renderer: "echarts",
    type: "pie",
  };
  const legacyResponse = { configuration: {}, renderer: "chartjs" };

  assert.equal(selectEChartsRender({
    loading: true,
    previous,
    render: legacyResponse,
    type: "doughnut",
  }), previous);
  assert.equal(selectEChartsRender({
    loading: false,
    previous,
    render: legacyResponse,
    type: "doughnut",
  }), null);
});
