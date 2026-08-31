import assert from "node:assert/strict";
import test from "node:test";

import { getOnboardingPlan } from "./homeOnboardingState.js";

test("keeps the foundation linear and unlocks parallel work after the first chart", () => {
  assert.deepEqual(getOnboardingPlan({
    automaticUpdates: false,
    chart: false,
    connection: false,
    dataset: false,
    sharedDashboard: false,
    teammate: false,
    watchedMetric: false,
  }), {
    comingUpKeys: ["dataset", "chart"],
    primaryKey: "connection",
    secondaryKeys: ["teammate"],
  });

  assert.deepEqual(getOnboardingPlan({
    automaticUpdates: false,
    chart: true,
    connection: true,
    dataset: true,
    sharedDashboard: false,
    teammate: false,
    watchedMetric: false,
  }), {
    comingUpKeys: [],
    primaryKey: "watchedMetric",
    secondaryKeys: ["automaticUpdates", "teammate", "sharedDashboard"],
  });
});
