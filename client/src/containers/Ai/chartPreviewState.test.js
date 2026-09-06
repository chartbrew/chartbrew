import assert from "node:assert/strict";
import test from "node:test";

import {
  getChartPreviewKey,
  setChartPreviewFailed,
  setChartPreviewLoaded,
  setChartPreviewLoading,
  setChartPreviewUnavailable,
  shouldLoadChartPreview,
} from "./chartPreviewState.js";

const preview = { chartId: 44, projectId: 77 };

test("loads each authenticated chart preview once and allows retry", () => {
  const fetched = new Set();
  assert.equal(shouldLoadChartPreview(fetched, preview), true);
  fetched.add(getChartPreviewKey(preview));
  assert.equal(shouldLoadChartPreview(fetched, preview), false);
  assert.equal(shouldLoadChartPreview(fetched, preview, true), true);
  assert.equal(shouldLoadChartPreview(fetched, { chartId: 44 }), false);
});

test("keeps explicit loading, success, and retryable failure states", () => {
  const key = getChartPreviewKey(preview);
  const loading = setChartPreviewLoading({}, key);
  assert.deepEqual(loading[key], { chart: null, error: false });
  const loaded = setChartPreviewLoaded(loading, key, { id: 44, name: "Trials" });
  assert.equal(loaded[key].chart.name, "Trials");
  const failed = setChartPreviewFailed(loaded, key);
  assert.deepEqual(failed[key], { chart: null, error: true });
  const unavailable = setChartPreviewUnavailable(loaded, key);
  assert.deepEqual(unavailable[key], { chart: null, error: false, unavailable: true });
});
