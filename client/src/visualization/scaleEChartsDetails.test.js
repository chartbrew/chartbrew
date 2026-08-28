import assert from "node:assert/strict";
import test from "node:test";

import { compactEChartsAxes, scaleEChartsDetails } from "./scaleEChartsDetails.js";

test("scales visible chart details without scaling data values", () => {
  const option = {
    grid: { left: 12, top: 20 },
    series: [{ data: [10, 20], lineStyle: { width: 2 }, symbolSize: 6 }],
    xAxis: { axisLabel: { fontSize: 11, width: 60 } },
  };
  const scaled = scaleEChartsDetails(option, 2);

  assert.deepEqual(scaled.series[0].data, [10, 20]);
  assert.equal(scaled.grid.left, 24);
  assert.equal(scaled.series[0].lineStyle.width, 4);
  assert.equal(scaled.series[0].symbolSize, 12);
  assert.equal(scaled.xAxis.axisLabel.fontSize, 22);
  assert.equal(scaled.xAxis.axisLabel.width, 120);
});

test("compacts mobile axes without changing category data", () => {
  const option = {
    xAxis: { axisLabel: { fontSize: 11 }, data: ["Jan", "Feb"], type: "category" },
    yAxis: [
      { splitNumber: 8, type: "value" },
      { splitNumber: 3, type: "value" },
    ],
  };
  const compact = compactEChartsAxes(option);

  assert.deepEqual(compact.xAxis.data, ["Jan", "Feb"]);
  assert.equal(compact.xAxis.axisLabel.hideOverlap, true);
  assert.equal(compact.yAxis[0].splitNumber, 4);
  assert.equal(compact.yAxis[1].splitNumber, 3);
  assert.equal(compact.yAxis[0].axisLabel.hideOverlap, true);
});
