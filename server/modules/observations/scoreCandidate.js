const { median, medianAbsoluteDeviation } = require("./baseline");
const { getScoringPolicy } = require("./scoringPolicies");
const { getValueFormat } = require("./valueFormat");

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getSeverity(relativeMagnitude) {
  if (relativeMagnitude >= 0.5) return "critical";
  if (relativeMagnitude >= 0.25) return "high";
  return "medium";
}

function scoreCandidate(baselineResult, monitor, policy) {
  const scoreVersion = policy.scoringVersion || "deterministic-v1";
  const scoringPolicy = getScoringPolicy(scoreVersion);
  if (!baselineResult.eligible) {
    return { publish: false, reason: baselineResult.reason, scoreVersion };
  }

  const currentValue = baselineResult.current.value;
  const baselineValue = Number(baselineResult.baseline);
  const absoluteDelta = currentValue - baselineValue;
  if (!Number.isFinite(baselineValue) || baselineValue === 0) {
    return { publish: false, reason: "zero_or_invalid_baseline", scoreVersion };
  }

  const relativeDelta = absoluteDelta / Math.abs(baselineValue);
  const relativeMagnitude = Math.abs(relativeDelta);
  const valueFormat = getValueFormat(monitor.metric_spec);
  const percentagePointMagnitude = valueFormat.type === "percentage"
    ? Math.abs(absoluteDelta * valueFormat.scale)
    : null;
  const completeness = Math.min(
    Number(baselineResult.current.completeness),
    Number(baselineResult.comparison.completeness ?? 1)
  );
  if (!Number.isFinite(completeness) || completeness < 0.9) {
    return { publish: false, reason: "incomplete_data", scoreVersion };
  }

  const historyMedian = median(baselineResult.historyValues);
  const mad = medianAbsoluteDeviation(baselineResult.historyValues);
  const robustDeviation = mad && historyMedian !== null
    ? Math.abs(currentValue - historyMedian) / (mad * 1.4826)
    : null;
  const magnitudeScore = clamp(relativeMagnitude / scoringPolicy.magnitudeTarget);
  const deviationScore = robustDeviation === null
    ? 0
    : clamp(robustDeviation / scoringPolicy.robustDeviationTarget);
  const importanceBonus = clamp(
    (Number(monitor.importance) - 1) * scoringPolicy.importanceBonusStep,
    0,
    scoringPolicy.importanceBonusMaximum
  );
  const score = clamp(
    (magnitudeScore * (robustDeviation === null
      ? scoringPolicy.magnitudeWeightWithoutDeviation
      : scoringPolicy.magnitudeWeight))
      + (deviationScore * scoringPolicy.robustDeviationWeight)
      + importanceBonus
  );
  const configuredPercentagePointThreshold = Number(policy.minimumPercentagePointChange);
  const minimumPercentagePointChange = Number.isFinite(configuredPercentagePointThreshold)
    && configuredPercentagePointThreshold >= 0
    ? configuredPercentagePointThreshold
    : 1;
  const meetsPercentagePointThreshold = percentagePointMagnitude === null
    || percentagePointMagnitude >= minimumPercentagePointChange;
  const publish = relativeMagnitude >= policy.minimumRelativeChange
    && meetsPercentagePointThreshold
    && score >= policy.publishScore;
  let reason = null;
  if (!publish) {
    reason = meetsPercentagePointThreshold ? "below_threshold" : "below_absolute_threshold";
  }

  return {
    absoluteDelta,
    baselineValue,
    confidence: robustDeviation !== null
      && baselineResult.sampleCount >= scoringPolicy.confidenceSampleCount
      ? "high"
      : "medium",
    currentValue,
    direction: absoluteDelta > 0 ? "increase" : "decrease",
    features: {
      completeness,
      deviationScore,
      importance: Number(monitor.importance),
      magnitudeScore,
      percentagePointMagnitude,
      relativeMagnitude,
      robustDeviation,
    },
    publish,
    reason,
    relativeDelta,
    score,
    scoreVersion,
    severity: getSeverity(relativeMagnitude),
  };
}

module.exports = {
  clamp,
  getSeverity,
  scoreCandidate,
};
