import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCartesianPerformanceOptions,
  compactBarChartData,
  getCartesianChartComplexity,
  MAX_RENDERED_POINTS,
  MAX_RENDERED_SERIES,
} from "./cartesianChartPerformance.js";

test("detects dense charts and counts sparse bars by rendered values", () => {
  const data = {
    labels: ["A", "B", "C"],
    datasets: Array.from({ length: 20 }, () => ({ data: [1, null, 2] })),
  };

  assert.deepEqual(getCartesianChartComplexity(data, "bar"), {
    blocked: false,
    densePointCount: 60,
    highDensity: true,
    presentPointCount: 40,
    renderedPointCount: 40,
    seriesCount: 20,
  });
});

test("compacts missing vertical and horizontal bars into Chart.js points", () => {
  const data = {
    labels: ["A", "B", "C"],
    datasets: [{ data: [10, null, 30], label: "Revenue" }],
  };

  assert.deepEqual(compactBarChartData(data).datasets[0].data, [
    { x: "A", y: 10 },
    { x: "C", y: 30 },
  ]);
  assert.deepEqual(compactBarChartData(data, true).datasets[0].data, [
    { x: 10, y: "A" },
    { x: 30, y: "C" },
  ]);
});

test("disables animation and all-series hover for dense charts", () => {
  const options = { plugins: { tooltip: { enabled: false } } };
  applyCartesianPerformanceOptions(options, { highDensity: true }, "line");

  assert.equal(options.animation, false);
  assert.equal(options.normalized, true);
  assert.deepEqual(options.interaction, { intersect: false, mode: "nearest" });
  assert.equal(options.plugins.tooltip.mode, "nearest");
});

test("blocks charts above the point rendering budget", () => {
  const data = {
    datasets: [{ data: Array.from({ length: MAX_RENDERED_POINTS + 1 }, () => 1) }],
  };

  assert.equal(getCartesianChartComplexity(data, "line").blocked, true);
});

test("blocks excessive series even when they contain few values", () => {
  const data = {
    datasets: Array.from({ length: MAX_RENDERED_SERIES + 1 }, () => ({ data: [1] })),
  };

  assert.equal(getCartesianChartComplexity(data, "bar").blocked, true);
});
