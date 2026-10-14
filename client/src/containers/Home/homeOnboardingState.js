const FOUNDATION_KEYS = ["connection", "dataset", "chart"];
const FOLLOWUP_KEYS = ["watchedMetric", "automaticUpdates", "sharedDashboard", "teammate"];
const DISPLAY_KEYS = [
  ...FOUNDATION_KEYS,
  "automaticUpdates",
  "watchedMetric",
  "teammate",
  "sharedDashboard",
];

export const STARTER_SUGGESTIONS = [
  { id: "starter-metrics", title: "What should I track?", prompt: "What should my business measure first?", starter: true },
  { id: "starter-report", title: "What goes in my report?", prompt: "What would a useful weekly report show for my business?", starter: true },
  { id: "starter-data", title: "Which data comes first?", prompt: "Which data should I connect first to answer my business questions?", starter: true },
];

export function getHomeSuggestions({ content, dataHealth, hasWatchedMetric, observations, setupState, suggestionActions, starterSuggestions }) {
  if (content?.canConfigureTeam && !content.hasConnection && !content.hasDataset && !content.hasChart) {
    return starterSuggestions?.length ? starterSuggestions : STARTER_SUGGESTIONS;
  }
  if (Array.isArray(suggestionActions) && !suggestionActions.includes("report")) return ["What can I ask?"];
  if (dataHealth?.count > 0) {
    return content?.canConfigureTeam
      ? ["Check data freshness", "Which data needs attention?", "How can I fix these data issues?"]
      : ["Check data freshness", "Which data needs attention?"];
  }
  if (!content?.canConfigureTeam) {
    return content?.hasChart
      ? ["Summarize my dashboard", "Show my latest results", "Check data freshness"]
      : ["How do I get started?", "What reports can I access?"];
  }
  if (!content.hasDataset) {
    return ["Explore my connected data", "What can I learn from my data?"];
  }
  if (!content.hasChart) {
    return ["Create a chart from my dataset", "Find useful trends in my data"];
  }
  if (!hasWatchedMetric) {
    if (Array.isArray(suggestionActions) && !suggestionActions.includes("prepare_watch")) {
      return ["Summarize my dashboard", "Show my latest results", "Check data freshness"];
    }
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
