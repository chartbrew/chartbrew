const { createHash } = require("../updateAudit");
const { getMonitorPeriodContract } = require("./periodContract");
const { getCompletedPeriodWindows } = require("./periodWindows");

function readSnapshot(snapshot) {
  const periodStart = new Date(snapshot.period_start ?? snapshot.periodStart);
  const periodEnd = new Date(snapshot.period_end ?? snapshot.periodEnd);
  const resultAsOfValue = snapshot.result_as_of ?? snapshot.resultAsOf;
  const resultAsOf = resultAsOfValue ? new Date(resultAsOfValue) : null;
  return {
    completeness: Number(snapshot.completeness),
    coverage: snapshot.coverage || "unknown",
    id: snapshot.id || null,
    periodEnd,
    periodStart,
    resultAsOf,
    value: Number(snapshot.value),
  };
}

function hasValidSnapshotShape(snapshot) {
  return Number.isFinite(snapshot.periodStart.getTime())
    && Number.isFinite(snapshot.periodEnd.getTime())
    && snapshot.periodEnd > snapshot.periodStart
    && Number.isFinite(snapshot.value);
}

function isComplete(snapshot) {
  return snapshot.coverage === "complete" && snapshot.completeness === 1;
}

function sameInstant(left, right) {
  return left.getTime() === right.getTime();
}

function snapshotsInsideWindow(snapshots, window) {
  return snapshots.filter((snapshot) => {
    return snapshot.periodStart >= window.start && snapshot.periodEnd <= window.end;
  }).sort((left, right) => left.periodStart - right.periodStart);
}

function aggregateCompleteFlow(snapshots, window) {
  const selected = snapshotsInsideWindow(snapshots, window);
  if (selected.length === 0) return { reason: "missing_window" };
  const partialOverlap = snapshots.some((snapshot) => {
    const overlaps = snapshot.periodStart < window.end && snapshot.periodEnd > window.start;
    const contained = snapshot.periodStart >= window.start && snapshot.periodEnd <= window.end;
    return overlaps && !contained;
  });
  if (partialOverlap) return { reason: "incomplete_coverage" };
  if (!sameInstant(selected[0].periodStart, window.start)
    || !sameInstant(selected[selected.length - 1].periodEnd, window.end)) {
    return { reason: "incomplete_coverage" };
  }
  for (let index = 0; index < selected.length; index += 1) {
    if (!isComplete(selected[index])) return { reason: "incomplete_coverage" };
    if (index > 0 && !sameInstant(selected[index - 1].periodEnd, selected[index].periodStart)) {
      return { reason: "incomplete_coverage" };
    }
  }
  return {
    completeness: 1,
    selected,
    value: selected.reduce((total, snapshot) => total + snapshot.value, 0),
  };
}

function getNativePeriodValue(snapshots, window) {
  const selected = snapshots.filter((snapshot) => {
    return sameInstant(snapshot.periodStart, window.start)
      && sameInstant(snapshot.periodEnd, window.end);
  });
  if (selected.length !== 1) return { reason: "native_period_required" };
  if (!isComplete(selected[0])) return { reason: "incomplete_coverage" };
  return { completeness: 1, selected, value: selected[0].value };
}

function getStateCheckpoint(snapshots, boundary, toleranceMinutes) {
  const toleranceMs = toleranceMinutes * 60 * 1000;
  const selected = snapshots
    .map((snapshot) => {
      const startDistance = Math.abs(snapshot.periodStart.getTime() - boundary.getTime());
      const endDistance = Math.abs(snapshot.periodEnd.getTime() - boundary.getTime());
      return {
        boundaryRank: endDistance === 0 ? 0 : 1,
        distance: Math.min(startDistance, endDistance),
        snapshot,
      };
    })
    .filter((candidate) => candidate.distance <= toleranceMs && isComplete(candidate.snapshot))
    .sort((left, right) => {
      if (left.distance !== right.distance) return left.distance - right.distance;
      if (left.boundaryRank !== right.boundaryRank) return left.boundaryRank - right.boundaryRank;
      return right.snapshot.periodStart - left.snapshot.periodStart;
    })[0];
  if (!selected) return { reason: "checkpoint_missing" };
  return {
    completeness: selected.snapshot.completeness,
    selected: [selected.snapshot],
    value: selected.snapshot.value,
  };
}

function thresholdPassed({ baselineValue, currentValue, metricSpec, publicationPolicy }) {
  const absoluteDelta = Math.abs(currentValue - baselineValue);
  if (publicationPolicy.thresholdType === "absolute") {
    return absoluteDelta >= publicationPolicy.thresholdValue;
  }
  if (publicationPolicy.thresholdType === "percentage_points") {
    const scale = Number(metricSpec.valueFormat?.display?.scale) || 1;
    return absoluteDelta * scale >= publicationPolicy.thresholdValue;
  }
  if (baselineValue === 0) return false;
  return absoluteDelta / Math.abs(baselineValue) >= publicationPolicy.thresholdValue;
}

function waitingResult(windows, reason, readiness = "incomplete") {
  return {
    eligible: false,
    finality: null,
    readiness,
    reason,
    windows,
  };
}

function evaluateCompletedPeriod({
  asOf = new Date(),
  confirmedAt = null,
  monitor,
  snapshots = [],
}) {
  const contract = getMonitorPeriodContract(monitor);
  const policy = contract.baselinePolicy;
  const windows = getCompletedPeriodWindows({
    asOf,
    comparison: policy.comparison,
    comparisonPeriod: policy.comparisonPeriod,
    periodMode: policy.periodMode,
    timezone: policy.calendarTimezone,
    weekStartsOn: policy.weekStartsOn,
  });
  const normalizedSnapshots = snapshots.map(readSnapshot).filter(hasValidSnapshotShape);
  const sourceConfirmedAt = confirmedAt
    ? new Date(confirmedAt)
    : normalizedSnapshots.reduce((latest, snapshot) => {
      if (!snapshot.resultAsOf) return latest;
      return !latest || snapshot.resultAsOf > latest ? snapshot.resultAsOf : latest;
    }, null);

  if (!sourceConfirmedAt || sourceConfirmedAt < windows.current.end) {
    return waitingResult(windows, "waiting_for_fresh_data", "waiting");
  }

  let comparison;
  let current;
  if (contract.metricBehavior === "flow") {
    comparison = aggregateCompleteFlow(normalizedSnapshots, windows.comparison);
    current = aggregateCompleteFlow(normalizedSnapshots, windows.current);
  } else if (contract.metricBehavior === "state") {
    comparison = getStateCheckpoint(
      normalizedSnapshots,
      windows.comparison.end,
      policy.checkpointToleranceMinutes
    );
    current = getStateCheckpoint(
      normalizedSnapshots,
      windows.current.end,
      policy.checkpointToleranceMinutes
    );
    if (comparison.selected?.[0] === current.selected?.[0]) {
      return waitingResult(windows, "checkpoint_missing");
    }
  } else {
    comparison = getNativePeriodValue(normalizedSnapshots, windows.comparison);
    current = getNativePeriodValue(normalizedSnapshots, windows.current);
  }

  if (comparison.reason || current.reason) {
    return waitingResult(windows, current.reason || comparison.reason);
  }

  const baselineValue = comparison.value;
  const currentValue = current.value;
  const absoluteDelta = currentValue - baselineValue;
  const relativeDelta = baselineValue === 0 ? null : absoluteDelta / Math.abs(baselineValue);
  const finalizedAt = new Date(
    windows.current.end.getTime() + (policy.settlingDelayMinutes * 60 * 1000)
  );
  const finality = new Date(asOf) >= finalizedAt ? "final" : "settling";
  const sourceSnapshots = [...comparison.selected, ...current.selected];
  const evidence = {
    comparisonPeriod: windows.comparison,
    confirmedAt: sourceConfirmedAt,
    currentPeriod: windows.current,
    inputFingerprint: createHash(sourceSnapshots.map((snapshot) => ({
      completeness: snapshot.completeness,
      coverage: snapshot.coverage,
      periodEnd: snapshot.periodEnd,
      periodStart: snapshot.periodStart,
      value: snapshot.value,
    }))),
    sourceCount: sourceSnapshots.length,
  };

  return {
    absoluteDelta,
    baselineValue,
    completeness: Math.min(comparison.completeness, current.completeness),
    currentValue,
    eligible: true,
    evaluationKey: createHash({
      comparison: windows.comparison,
      current: windows.current,
      definitionFingerprint: monitor.definition_fingerprint,
      monitorId: monitor.id,
      policyVersion: policy.policyVersion,
    }),
    evidence,
    finalizedAt: finality === "final" ? finalizedAt : null,
    finality,
    passesThreshold: thresholdPassed({
      baselineValue,
      currentValue,
      metricSpec: monitor.metric_spec,
      publicationPolicy: contract.publicationPolicy,
    }),
    readiness: "eligible",
    relativeDelta,
    sourceBucketCount: contract.metricBehavior === "state" ? 0 : sourceSnapshots.length,
    sourceCheckpointCount: contract.metricBehavior === "state" ? sourceSnapshots.length : 0,
    windows,
  };
}

module.exports = {
  aggregateCompleteFlow,
  evaluateCompletedPeriod,
  getNativePeriodValue,
  getStateCheckpoint,
  thresholdPassed,
};
