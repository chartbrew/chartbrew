import assert from "node:assert/strict";
import test from "node:test";

import getChartRefreshInterval from "./getChartRefreshInterval.js";

test("charts without auto-update do not create a refresh timer", () => {
  assert.equal(getChartRefreshInterval(null), null);
  assert.equal(getChartRefreshInterval(0), null);
  assert.equal(getChartRefreshInterval(undefined), null);
});

test("configured chart refresh timers use seconds and cap polling at ten minutes", () => {
  assert.equal(getChartRefreshInterval(30), 30000);
  assert.equal(getChartRefreshInterval(600), 600000);
  assert.equal(getChartRefreshInterval(3600), 600000);
});

test("public dashboard charts do not create individual refresh timers", () => {
  assert.equal(getChartRefreshInterval(30, true), null);
});
