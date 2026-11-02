import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHomeActivityRows,
  removeHomeActivityItem,
  shouldShowNeedsAttention,
} from "./homeAttentionState.js";

test("shows Needs attention after a metric is watched", () => {
  assert.equal(shouldShowNeedsAttention({
    hasWatchedMetric: true,
    recommendationCount: 0,
  }), true);
});

test("orders Home activity by data health, attention, and notable changes", () => {
  const rows = buildHomeActivityRows({
    dataHealth: [{ id: "refresh", action: { path: "/health/refresh" } }],
    needsAttention: [{ id: "decline" }],
    notableChanges: [{ id: "growth" }],
  });

  assert.deepEqual(rows.map((row) => row.category), ["health", "attention", "notable"]);
  assert.deepEqual(rows.map((row) => row.path), [
    "/health/refresh",
    "/activity/decline",
    "/activity/growth",
  ]);
});

test("removes a resolved change from Home activity", () => {
  const resolved = { id: "decline" };
  const remaining = { id: "growth" };
  const data = removeHomeActivityItem({
    needsAttention: [resolved],
    notableChanges: [remaining],
    observations: [resolved, remaining],
  }, resolved.id);

  assert.deepEqual(data.needsAttention, []);
  assert.deepEqual(data.notableChanges, [remaining]);
  assert.deepEqual(data.observations, [remaining]);
});
