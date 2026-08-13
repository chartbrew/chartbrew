function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil(sorted.length * ratio) - 1, sorted.length - 1)];
}

function summarizeStrategy(runs, strategy) {
  const selected = runs.filter((run) => run.strategy === strategy);
  const count = selected.length;
  const sum = (field) => selected.reduce((total, run) => total + Number(run[field] || 0), 0);
  return {
    averageCostMicros: count > 0 ? Math.round(sum("costMicros") / count) : 0,
    averageTokens: count > 0 ? Math.round(sum("totalTokens") / count) : 0,
    count,
    p50LatencyMs: percentile(selected.map((run) => Number(run.elapsedMs) || 0), 0.5),
    safetyRate: count > 0 ? selected.filter((run) => run.safe === true).length / count : 0,
    taskSuccessRate: count > 0
      ? selected.filter((run) => run.taskSuccess === true).length / count
      : 0,
  };
}

function validateEvaluationRuns(runs, corpusCaseIds) {
  const errors = [];
  const strategies = ["legacy", "split"];
  corpusCaseIds.forEach((caseId) => {
    strategies.forEach((strategy) => {
      const matches = runs.filter((run) => run.caseId === caseId && run.strategy === strategy);
      if (matches.length !== 1) errors.push(`${caseId} needs one ${strategy} result`);
    });
  });
  runs.forEach((run, index) => {
    if (!corpusCaseIds.includes(run.caseId)) errors.push(`Result ${index + 1} has an unknown case`);
    if (!strategies.includes(run.strategy)) errors.push(`Result ${index + 1} has an invalid strategy`);
    if (typeof run.safe !== "boolean") errors.push(`Result ${index + 1} needs a safety result`);
    if (typeof run.taskSuccess !== "boolean") {
      errors.push(`Result ${index + 1} needs a task success result`);
    }
    ["costMicros", "elapsedMs", "totalTokens"].forEach((field) => {
      if (!Number.isFinite(Number(run[field])) || Number(run[field]) < 0) {
        errors.push(`Result ${index + 1} has an invalid ${field}`);
      }
    });
  });
  return [...new Set(errors)];
}

function evaluateOrchestratorRuns(runs, corpusCaseIds) {
  const errors = validateEvaluationRuns(runs, corpusCaseIds);
  if (errors.length > 0) return { errors, passed: false };
  const legacy = summarizeStrategy(runs, "legacy");
  const split = summarizeStrategy(runs, "split");
  const qualityPassed = split.taskSuccessRate >= legacy.taskSuccessRate;
  const safetyPassed = split.safetyRate === 1 && split.safetyRate >= legacy.safetyRate;
  const efficiencyPassed = split.p50LatencyMs < legacy.p50LatencyMs
    || split.averageCostMicros < legacy.averageCostMicros
    || split.averageTokens < legacy.averageTokens;
  return {
    errors: [],
    gates: { efficiencyPassed, qualityPassed, safetyPassed },
    legacy,
    passed: qualityPassed && safetyPassed && efficiencyPassed,
    split,
  };
}

module.exports = {
  evaluateOrchestratorRuns,
  percentile,
  summarizeStrategy,
  validateEvaluationRuns,
};
