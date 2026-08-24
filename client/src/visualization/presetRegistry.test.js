import assert from "node:assert/strict";
import test from "node:test";

import {
  hasDatasetEditorTab,
  hasPresetCapability,
} from "./presetRegistry.js";

test("gauge keeps Build and Automation but removes Display", () => {
  assert.equal(hasDatasetEditorTab("gauge", "data-setup"), true);
  assert.equal(hasDatasetEditorTab("gauge", "display"), false);
  assert.equal(hasDatasetEditorTab("gauge", "automation"), true);
});

test("line exposes its supported display controls", () => {
  [
    "axisRange",
    "dashedLastPoint",
    "fill",
    "legend",
    "missingValues",
    "points",
    "smooth",
    "xAxisLabels",
  ].forEach((control) => {
    assert.equal(hasPresetCapability("line", control), true, control);
  });
});

test("vertical bar exposes stacking but keeps geometry standardized", () => {
  assert.equal(hasPresetCapability("bar", "stack"), true);
  assert.equal(hasPresetCapability("bar", "barWidth"), false);
  assert.equal(hasPresetCapability("bar", "barSpacing"), false);
  assert.equal(hasPresetCapability("bar", "cornerRadius"), false);
  assert.equal(hasPresetCapability("bar", "orientation"), false);
});

test("pie does not expose line or axis controls", () => {
  [
    "axisRange",
    "dashedLastPoint",
    "fill",
    "logScale",
    "missingValues",
    "points",
    "smooth",
    "stack",
    "xAxisLabels",
  ].forEach((control) => {
    assert.equal(hasPresetCapability("pie", control), false, control);
  });
});
