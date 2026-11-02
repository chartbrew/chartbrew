function median(values) {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function medianAbsoluteDeviation(values) {
  const center = median(values);
  if (center === null) return null;
  return median(values.map((value) => Math.abs(Number(value) - center)));
}

function toPoint(snapshot) {
  return {
    completeness: Number(snapshot.completeness),
    periodEnd: new Date(snapshot.period_end || snapshot.periodEnd),
    periodStart: new Date(snapshot.period_start || snapshot.periodStart),
    value: Number(snapshot.value),
  };
}

function calculateBaseline(snapshots, monitor) {
  const points = snapshots
    .map(toPoint)
    .filter((point) => Number.isFinite(point.value) && !Number.isNaN(point.periodStart.getTime()))
    .sort((left, right) => left.periodStart - right.periodStart);
  if (points.length < 2) {
    return { eligible: false, reason: "needs_more_history", sampleCount: points.length };
  }

  const current = points[points.length - 1];
  const prior = points.slice(0, -1);
  if (monitor.kind === "timeseries") {
    const comparison = prior[prior.length - 1];
    return {
      baseline: comparison.value,
      comparison,
      current,
      eligible: true,
      historyValues: prior.map((point) => point.value),
      sampleCount: points.length,
    };
  }

  const minimumSamples = Number(monitor.minimum_samples) || 7;
  if (points.length < minimumSamples) {
    return { eligible: false, reason: "needs_more_history", sampleCount: points.length };
  }

  return {
    baseline: median(prior.map((point) => point.value)),
    comparison: {
      periodEnd: prior[prior.length - 1].periodEnd,
      periodStart: prior[0].periodStart,
    },
    current,
    eligible: true,
    historyValues: prior.map((point) => point.value),
    sampleCount: points.length,
  };
}

module.exports = {
  calculateBaseline,
  median,
  medianAbsoluteDeviation,
};
