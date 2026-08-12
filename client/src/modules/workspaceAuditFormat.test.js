import assert from "node:assert/strict";
import test from "node:test";

import {
  formatActionLabel,
  formatChangedFields,
  formatContextSections,
  formatContextVolume,
  formatPurpose,
  formatResult,
} from "./workspaceAuditFormat.js";

test("formats action history without internal action names", () => {
  assert.equal(formatActionLabel("metric_monitor.update"), "Updated a watched metric");
  assert.equal(
    formatChangedFields(["comparisonPeriod", "thresholdValue"]),
    "Comparison, Change amount"
  );
});

test("formats external sharing categories without values", () => {
  assert.equal(
    formatContextSections({ contextSections: ["activity", "learning"] }),
    "workspace activity, feedback and corrections"
  );
  assert.equal(formatPurpose("workspace_summary"), "Workspace summary");
  assert.equal(formatResult("validated"), "Completed");
  assert.equal(
    formatContextVolume({
      characterCount: 18420,
      factCounts: { evaluations: 9, observations: 4 },
      projectCount: 2,
      truncated: true,
    }),
    "13 facts · 2 dashboards · 18,420 characters · Shortened to fit the limit"
  );
});
