import assert from "node:assert/strict";
import test from "node:test";

import {
  getKpiMetricCapacity,
  getResponsiveGeometry,
  resolveBarComposition,
  resolveLineComposition,
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

test("limits KPI metrics by readable metric width", () => {
  assert.equal(getKpiMetricCapacity(189), 1);
  assert.equal(getKpiMetricCapacity(424), 3);
  assert.equal(getKpiMetricCapacity(1200), 8);
  assert.equal(getKpiMetricCapacity(1200, true), 4);
});
