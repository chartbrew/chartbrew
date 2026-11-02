function getRecommendationLearningScore(recommendation, signals = []) {
  const metricKey = recommendation._definition?.bindingKey;
  if (!metricKey) return 0;
  return signals.reduce((score, signal) => {
    if (signal.subject?.metricKey !== metricKey) return score;
    const verdict = signal.decision?.verdict;
    if (!["relevant", "not_relevant"].includes(verdict)) return score;
    if (signal.strength === "explicit_feedback") {
      return score + (verdict === "relevant" ? 4 : -4);
    }
    if (signal.strength === "workspace_aggregate") {
      return score + (verdict === "relevant" ? 2 : -2);
    }
    return score;
  }, 0);
}

function rankRecommendationsWithLearning(recommendations = [], signals = []) {
  return recommendations
    .map((recommendation, index) => ({
      index,
      recommendation,
      score: getRecommendationLearningScore(recommendation, signals),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item, index) => {
      let learningReason = null;
      if (item.index !== index && item.score > 0) {
        learningReason = "Your feedback made this suggestion more relevant.";
      } else if (item.index !== index && item.score < 0) {
        learningReason = "Your feedback made this suggestion less relevant.";
      }
      return {
        ...item.recommendation,
        learningReason,
      };
    });
}

function getActivityLearningScore(item, signals = []) {
  return signals.reduce((score, signal) => {
    const sameMonitor = item.monitorId
      && `${signal.subject?.monitorId || ""}` === `${item.monitorId}`;
    const sameProject = item.project?.id
      && Number(signal.scope?.projectId) === Number(item.project.id);
    if (signal.strength === "explicit_feedback") {
      if (!sameMonitor) return score;
      return score + (signal.decision?.verdict === "relevant" ? 6 : -6);
    }
    if (signal.strength === "explicit_correction") {
      return sameMonitor ? score + 5 : score;
    }
    if (signal.strength === "explicit_decision") {
      return sameMonitor ? score + 4 : score;
    }
    if (signal.strength !== "weak_attention") return score;
    const appliesToItem = sameMonitor
      || (signal.decision?.attention === "pinned" && sameProject);
    if (!appliesToItem) return score;
    if (signal.decision?.attention === "saved" || signal.decision?.attention === "pinned") {
      return score + 1;
    }
    if (["dismissed", "snoozed"].includes(signal.decision?.attention)) return score - 1;
    return score;
  }, 0);
}

function rankActivityItemsWithLearning(items = [], signals = []) {
  return items
    .map((item, index) => ({
      index,
      item,
      score: getActivityLearningScore(item, signals),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ item }) => item);
}

function rankActivityWithLearning(activity, signals = []) {
  return {
    ...activity,
    changes: rankActivityItemsWithLearning(activity.changes, signals),
    evaluations: rankActivityItemsWithLearning(activity.evaluations, signals),
  };
}

function getMetricPreviewLearningDefaults(signals = [], metricKey) {
  const applicable = signals.filter((signal) => signal.subject?.metricKey === metricKey);
  const correction = applicable.find((signal) => signal.strength === "explicit_correction");
  const configuration = applicable.find((signal) => signal.strength === "approved_configuration");
  const decision = correction?.decision?.after || configuration?.decision || {};
  const defaults = {};
  if (decision.comparisonPeriod) defaults.comparisonPeriod = decision.comparisonPeriod;
  if (decision.desiredDirection) defaults.desiredDirection = decision.desiredDirection;
  if (decision.importance) defaults.importance = decision.importance;
  if (decision.metricBehavior) defaults.metricBehavior = decision.metricBehavior;
  if (decision.thresholdType && decision.thresholdValue !== null
    && decision.thresholdValue !== undefined) {
    defaults.threshold = {
      type: decision.thresholdType,
      value: decision.thresholdValue,
    };
  }
  let reason = null;
  if (Object.keys(defaults).length > 0) {
    reason = correction
      ? "Based on a watched metric setting you corrected earlier."
      : "Based on a watched metric setting your team already approved.";
  }
  return { defaults, reason };
}

module.exports = {
  getActivityLearningScore,
  getMetricPreviewLearningDefaults,
  getRecommendationLearningScore,
  rankActivityItemsWithLearning,
  rankActivityWithLearning,
  rankRecommendationsWithLearning,
};
