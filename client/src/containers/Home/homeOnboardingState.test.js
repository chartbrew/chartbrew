import assert from "node:assert/strict";
import test from "node:test";

import { getHomeSuggestions, getOnboardingPlan } from "./homeOnboardingState.js";

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


test("suggestions follow available content, recovery and permissions", () => {
  const home = {
    content: { canConfigureTeam: true, hasConnection: false, hasDataset: false, hasChart: false },
    dataHealth: { count: 0 },
    observations: [],
  };
  assert.deepEqual(getHomeSuggestions(home), []);
  home.content.hasConnection = true;
  assert.equal(getHomeSuggestions(home)[0], "Explore my connected data");
  home.content.hasDataset = true;
  assert.equal(getHomeSuggestions(home)[0], "Create a chart from my dataset");
  home.content.hasChart = true;
  assert.equal(getHomeSuggestions(home)[1], "Which metric should I watch?");
  home.hasWatchedMetric = true;
  home.setupState = "collecting_baseline";
  assert.equal(getHomeSuggestions(home)[0], "Show my latest results");
  home.setupState = "active";
  home.observations = [{}];
  assert.equal(getHomeSuggestions(home)[0], "Summarize recent changes");
  home.observations = [];
  assert.equal(getHomeSuggestions(home)[0], "Summarize my dashboard");
  home.dataHealth.count = 1;
  assert.equal(getHomeSuggestions(home)[0], "Check data freshness");
  home.dataHealth.count = 0;
  home.content.canConfigureTeam = false;
  assert.deepEqual(getHomeSuggestions(home), ["Summarize my dashboard", "Show my latest results", "Check data freshness"]);
  home.content.hasChart = false;
  assert.deepEqual(getHomeSuggestions(home), ["How do I get started?", "What reports can I access?"]);
});
