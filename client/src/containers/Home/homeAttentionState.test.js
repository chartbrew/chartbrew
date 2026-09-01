import assert from "node:assert/strict";
import test from "node:test";

import { shouldShowNeedsAttention } from "./homeAttentionState.js";

test("shows Needs attention after a metric is watched", () => {
  assert.equal(shouldShowNeedsAttention({
    hasWatchedMetric: true,
    recommendationCount: 0,
  }), true);
});
