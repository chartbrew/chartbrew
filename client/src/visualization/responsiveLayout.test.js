import assert from "node:assert/strict";
import test from "node:test";

import {
  getKpiMetricCapacity,
  getResponsiveGeometry,
  resolveBarComposition,
  resolveCategoryComposition,
  resolveGaugeComposition,
  resolveHorizontalBarComposition,
  resolveLineComposition,
  resolveMatrixComposition,
} from "./responsiveLayout.js";

test("resolves width, height, and shape independently", () => {
  assert.deepEqual(getResponsiveGeometry(189, 231), {
    height: "regular",
    shape: "balanced",
    width: "narrow",
  });
  assert.deepEqual(getResponsiveGeometry(424, 80), {
    height: "shallow",
    shape: "panoramic",
    width: "regular",
  });
});

test("selects line compositions from geometry and mark density", () => {
  assert.equal(resolveLineComposition({ height: 104, pointCount: 30, width: 189 }), "sparkline");
  assert.equal(resolveLineComposition({ height: 80, pointCount: 30, width: 424 }), "sparkline");
  assert.equal(resolveLineComposition({ height: 231, pointCount: 30, width: 424 }), "limited");
  assert.equal(resolveLineComposition({ height: 300, pointCount: 30, width: 800 }), "analysis");
  assert.equal(resolveLineComposition({ height: 300, pointCount: 80, width: 800 }), "limited");
});

test("selects vertical bar compositions from geometry and mark density", () => {
  assert.equal(resolveBarComposition({ height: 104, pointCount: 30, width: 189 }), "sparkline");
  assert.equal(resolveBarComposition({ height: 80, pointCount: 30, width: 424 }), "sparkline");
  assert.equal(resolveBarComposition({ height: 231, pointCount: 30, width: 424 }), "limited");
  assert.equal(resolveBarComposition({ height: 300, pointCount: 30, width: 800 }), "analysis");
  assert.equal(resolveBarComposition({ height: 300, pointCount: 80, width: 800 }), "limited");
});

test("selects category compositions from independent width and height bands", () => {
  assert.equal(resolveCategoryComposition({ height: 104, width: 189 }), "micro");
  assert.equal(resolveCategoryComposition({ height: 104, width: 424 }), "side-summary");
  assert.equal(resolveCategoryComposition({ height: 231, width: 189 }), "stacked-summary");
  assert.equal(resolveCategoryComposition({ height: 231, width: 424 }), "centered");
  assert.equal(resolveCategoryComposition({ height: 300, width: 800 }), "side-breakdown");
  assert.equal(resolveCategoryComposition({ height: 400, width: 424 }), "stacked-breakdown");
  assert.equal(resolveCategoryComposition({ height: 400, width: 189 }), "stacked-breakdown");
});

test("selects horizontal bar comparison and compact compositions", () => {
  assert.equal(resolveHorizontalBarComposition({ height: 104, width: 424 }), "compact");
  assert.equal(resolveHorizontalBarComposition({ height: 231, width: 189 }), "compact");
  assert.equal(resolveHorizontalBarComposition({ height: 231, width: 424 }), "comparison");
});

test("selects matrix compositions from geometry and cell density", () => {
  assert.equal(resolveMatrixComposition({ columnCount: 5, height: 104, rowCount: 7, width: 424 }), "dense");
  assert.equal(resolveMatrixComposition({ columnCount: 5, height: 231, rowCount: 7, width: 189 }), "dense");
  assert.equal(resolveMatrixComposition({ columnCount: 5, height: 231, rowCount: 7, width: 424 }), "bounded");
  assert.equal(resolveMatrixComposition({ columnCount: 5, height: 400, rowCount: 7, width: 800 }), "labeled");
  assert.equal(resolveMatrixComposition({ columnCount: 60, height: 400, rowCount: 7, width: 800 }), "bounded");
});

test("selects gauge compositions from width and height", () => {
  assert.equal(resolveGaugeComposition({ height: 104, width: 189 }), "micro");
  assert.equal(resolveGaugeComposition({ height: 104, width: 424 }), "side-summary");
  assert.equal(resolveGaugeComposition({ height: 231, width: 189 }), "compact");
  assert.equal(resolveGaugeComposition({ height: 231, width: 424 }), "centered");
  assert.equal(resolveGaugeComposition({ height: 300, width: 800 }), "large");
});

test("limits KPI metrics by readable metric width", () => {
  assert.equal(getKpiMetricCapacity(189), 1);
  assert.equal(getKpiMetricCapacity(424), 3);
  assert.equal(getKpiMetricCapacity(1200), 8);
  assert.equal(getKpiMetricCapacity(1200, true), 4);
});
