const FOUNDATION_KEYS = ["connection", "dataset", "chart"];
const FOLLOWUP_KEYS = ["watchedMetric", "automaticUpdates", "sharedDashboard", "teammate"];
const DISPLAY_KEYS = [
  ...FOUNDATION_KEYS,
  "automaticUpdates",
  "watchedMetric",
  "teammate",
  "sharedDashboard",
];

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
