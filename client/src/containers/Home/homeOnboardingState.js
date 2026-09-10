const FOUNDATION_KEYS = ["connection", "dataset", "chart"];
const FOLLOWUP_KEYS = ["watchedMetric", "automaticUpdates", "sharedDashboard", "teammate"];
const DISPLAY_KEYS = [
  ...FOUNDATION_KEYS,
  "automaticUpdates",
  "watchedMetric",
  "teammate",
  "sharedDashboard",
];

export function getHomeSuggestions({ content, dataHealth, hasWatchedMetric, observations, setupState }) {
  if (dataHealth?.count > 0) {
    return ["Check data freshness", "Which data needs attention?", "How can I fix these data issues?"];
  }
  if (!content?.canConfigureTeam) {
    return content?.hasChart
      ? ["Summarize my dashboard", "Show my latest results", "Check data freshness"]
      : ["How do I get started?", "What reports can I access?"];
  }
  if (!content.hasConnection && !content.hasDataset && !content.hasChart) {
    return [];
  }
  if (!content.hasDataset) {
    return ["Explore my connected data", "What can I learn from my data?"];
  }
  if (!content.hasChart) {
    return ["Create a chart from my dataset", "Find useful trends in my data"];
  }
  if (!hasWatchedMetric) {
    return ["Summarize my dashboard", "Which metric should I watch?", "Check data freshness"];
  }
  if (["collecting_baseline", "waiting_for_data", "metrics_need_review"].includes(setupState)) {
    return ["Show my latest results", "Show my watched metrics", "Check data freshness"];
  }
  return observations?.length > 0
    ? ["Summarize recent changes", "Which metrics need attention?", "Check data freshness"]
    : ["Summarize my dashboard", "Show my watched metrics", "Check data freshness"];
}

export function getOnboardingPlan(milestones) {
  const foundationKey = FOUNDATION_KEYS.find((key) => !milestones[key]);
  const primaryKey = foundationKey || FOLLOWUP_KEYS.find((key) => !milestones[key]);
  const availableKeys = new Set(["connection", "teammate"]);
  if (milestones.connection) availableKeys.add("dataset");
  if (milestones.dataset) availableKeys.add("chart");
  if (milestones.chart) {
    ["automaticUpdates", "watchedMetric", "sharedDashboard"].forEach((key) => {
      availableKeys.add(key);
    });
  }

  return {
    comingUpKeys: FOUNDATION_KEYS.filter((key) => (
      !milestones[key] && key !== primaryKey && !availableKeys.has(key)
    )),
    primaryKey,
    secondaryKeys: DISPLAY_KEYS.filter((key) => (
      !milestones[key] && key !== primaryKey && availableKeys.has(key)
    )),
  };
}
