const { median, medianAbsoluteDeviation } = require("./baseline");

const SCORE_VERSION = "deterministic-v1";

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getSeverity(relativeMagnitude) {
  if (relativeMagnitude >= 0.5) return "critical";
  if (relativeMagnitude >= 0.25) return "high";
  return "medium";
}

function scoreCandidate(baselineResult, monitor, policy) {
  if (!baselineResult.eligible) {
    return { publish: false, reason: baselineResult.reason };
  }

  const currentValue = baselineResult.current.value;
  const baselineValue = Number(baselineResult.baseline);
  const absoluteDelta = currentValue - baselineValue;
  if (!Number.isFinite(baselineValue) || baselineValue === 0) {
    return { publish: false, reason: "zero_or_invalid_baseline" };
  }

  const relativeDelta = absoluteDelta / Math.abs(baselineValue);
  const relativeMagnitude = Math.abs(relativeDelta);
  const completeness = Math.min(
    Number(baselineResult.current.completeness),
    Number(baselineResult.comparison.completeness ?? 1)
  );
  if (!Number.isFinite(completeness) || completeness < 0.9) {
    return { publish: false, reason: "incomplete_data" };
  }

  const historyMedian = median(baselineResult.historyValues);
  const mad = medianAbsoluteDeviation(baselineResult.historyValues);
  const robustDeviation = mad && historyMedian !== null
    ? Math.abs(currentValue - historyMedian) / (mad * 1.4826)
    : null;
  const magnitudeScore = clamp(relativeMagnitude / 0.2);
  const deviationScore = robustDeviation === null ? 0 : clamp(robustDeviation / 3.5);
  const importanceBonus = clamp((Number(monitor.importance) - 1) * 0.05, 0, 0.1);
  const score = clamp(
    (magnitudeScore * (robustDeviation === null ? 0.9 : 0.75))
      + (deviationScore * 0.25)
      + importanceBonus
  );
  const publish = relativeMagnitude >= policy.minimumRelativeChange
    && score >= policy.publishScore;

  return {
    absoluteDelta,
    baselineValue,
    confidence: robustDeviation !== null && baselineResult.sampleCount >= 7 ? "high" : "medium",
    currentValue,
    direction: absoluteDelta > 0 ? "increase" : "decrease",
    features: {
      completeness,
      deviationScore,
      importance: Number(monitor.importance),
      magnitudeScore,
      relativeMagnitude,
      robustDeviation,
    },
    publish,
    reason: publish ? null : "below_threshold",
    relativeDelta,
    score,
    scoreVersion: SCORE_VERSION,
    severity: getSeverity(relativeMagnitude),
  };
}

module.exports = {
  SCORE_VERSION,
  clamp,
  getSeverity,
  scoreCandidate,
};
