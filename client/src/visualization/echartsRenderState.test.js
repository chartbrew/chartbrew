import assert from "node:assert/strict";
import test from "node:test";

import {
  getEChartsAnimation,
  getEChartsPreset,
  isCompatibleEChartsRender,
  selectEChartsRender,
} from "./echartsRenderState.js";

test("animates only the first canvas render when motion is allowed", () => {
  assert.deepEqual(getEChartsAnimation({ animation: true }, true, false, "canvas"), {
    animation: true,
    animationDuration: 380,
    animationEasing: "cubicOut",
  });
  assert.equal(getEChartsAnimation({ animation: true }, false, false, "canvas").animation, false);
  assert.equal(getEChartsAnimation({ animation: true }, true, true, "canvas").animation, false);
  assert.equal(getEChartsAnimation({ animation: true }, true, false, "svg").animation, false);
  assert.equal(getEChartsAnimation({ animation: false }, true, false, "canvas").animation, false);
});

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

test("treats a filled line option as a line chart", () => {
  assert.equal(getEChartsPreset({
    series: [{ areaStyle: { opacity: 0.2 }, type: "line" }],
  }), "line");
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
  const incompatibleResponse = { configuration: {}, renderer: "native" };

  assert.equal(selectEChartsRender({
    loading: true,
    previous,
    render: incompatibleResponse,
    type: "doughnut",
  }), previous);
  assert.equal(selectEChartsRender({
    loading: false,
    previous,
    render: incompatibleResponse,
    type: "doughnut",
  }), null);
});


test("identifies region and point maps before matrix charts", () => {
  assert.equal(getEChartsPreset({ series: [{ type: "map" }] }), "map");
  assert.equal(getEChartsPreset({ visualMap: {}, series: [{ type: "scatter", coordinateSystem: "geo" }] }), "map");
});
