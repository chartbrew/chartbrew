const {
  getObservationImpact,
  normalizeDesiredDirection,
} = require("./metricDirection");

const LOW_SAMPLE_THRESHOLD = 5;
const REPORT_VERSION = "observation-calibration-v1";

function toPlain(record) {
  return typeof record?.get === "function" ? record.get({ plain: true }) : record;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function createCohort() {
  return {
    notRelevant: 0,
    relevant: 0,
    total: 0,
    unsure: 0,
  };
}

function addVerdict(cohort, verdict) {
  cohort.total += 1;
  if (verdict === "relevant") cohort.relevant += 1;
  else if (verdict === "not_relevant") cohort.notRelevant += 1;
  else cohort.unsure += 1;
}

function finishCohort(cohort) {
  const rated = cohort.relevant + cohort.notRelevant;
  return {
    ...cohort,
    lowSample: rated < LOW_SAMPLE_THRESHOLD,
    relevanceRate: rated ? round(cohort.relevant / rated) : null,
  };
}

function addToCohorts(cohorts, key, verdict) {
  const cohortKey = key || "unknown";
  if (!cohorts[cohortKey]) cohorts[cohortKey] = createCohort();
  addVerdict(cohorts[cohortKey], verdict);
}

function finishCohorts(cohorts) {
  return Object.fromEntries(Object.entries(cohorts).map(([key, cohort]) => (
    [key, finishCohort(cohort)]
  )));
}

function getMagnitudeBucket(relativeDelta) {
  const magnitude = Math.abs(finiteNumber(relativeDelta) || 0);
  if (magnitude < 0.1) return "under_10_percent";
  if (magnitude < 0.25) return "10_to_25_percent";
  if (magnitude < 0.5) return "25_to_50_percent";
  return "50_percent_or_more";
}

function getLatestAudits(audits) {
  const latest = new Map();
  audits.forEach((rawAudit) => {
    const audit = toPlain(rawAudit);
    if (audit?.observation_id && !latest.has(audit.observation_id)) {
      latest.set(audit.observation_id, audit);
    }
  });
  return latest;
}

function normalizeFeedback(rawFeedback, latestAudits) {
  const feedback = toPlain(rawFeedback);
  const observation = toPlain(feedback?.Observation);
  if (!observation) return null;
  const monitor = toPlain(observation.MetricMonitor) || {};
  const evidence = observation.evidence || {};
  const featureValues = evidence.featureValues || {};
  const desiredDirection = normalizeDesiredDirection(monitor.metric_spec?.desiredDirection);
  const audit = latestAudits.get(observation.id);
  const auditVerdict = audit?.verdict;
  return {
    auditRelevant: typeof auditVerdict?.relevant === "boolean"
      ? auditVerdict.relevant
      : null,
    baselineType: monitor.baseline_policy?.type || evidence.baselinePolicy || "unknown",
    completeness: finiteNumber(evidence.completeness ?? featureValues.completeness),
    desiredDirection,
    features: featureValues,
    impact: getObservationImpact(desiredDirection, observation.direction),
    magnitudeBucket: getMagnitudeBucket(observation.relative_delta),
    monitorKind: monitor.kind || "unknown",
    observedDirection: observation.direction || "unknown",
    policyVersion: observation.score_version || "unknown",
    reasonCode: feedback.reason_code || null,
    sampleCount: finiteNumber(evidence.sampleCount),
    score: finiteNumber(observation.score),
    severity: observation.severity || "unknown",
    verdict: feedback.verdict,
  };
}

function summarizeFeatures(records, verdict) {
  const totals = {};
  const counts = {};
  records.filter((record) => record.verdict === verdict).forEach((record) => {
    Object.entries({
      ...record.features,
      completeness: record.completeness,
      sampleCount: record.sampleCount,
      score: record.score,
    }).forEach(([key, value]) => {
      const number = finiteNumber(value);
      if (number === null) return;
      totals[key] = (totals[key] || 0) + number;
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return Object.fromEntries(Object.keys(totals).sort().map((key) => [key, {
    average: round(totals[key] / counts[key]),
    samples: counts[key],
  }]));
}

function summarizeAudits(audits) {
  const summary = {
    notRelevant: 0,
    relevant: 0,
    suggestions: {},
    total: audits.length,
    unsupported: 0,
  };
  audits.forEach((rawAudit) => {
    const audit = toPlain(rawAudit);
    const verdict = audit?.verdict || {};
    summary[verdict.relevant ? "relevant" : "notRelevant"] += 1;
    if (!verdict.evidenceSupported) summary.unsupported += 1;
    (verdict.suggestedWeightChanges || []).forEach((suggestion) => {
      const key = `${suggestion.feature}:${suggestion.direction}`;
      summary.suggestions[key] = (summary.suggestions[key] || 0) + 1;
    });
  });
  return summary;
}

function buildCalibrationReport(options = {}) {
  const audits = options.audits || [];
  const latestAudits = getLatestAudits(audits);
  const records = (options.feedback || [])
    .map((feedback) => normalizeFeedback(feedback, latestAudits))
    .filter(Boolean);
  const overall = createCohort();
  const cohortFields = {
    baselineType: {},
    desiredDirection: {},
    impact: {},
    magnitude: {},
    monitorKind: {},
    observedDirection: {},
    policyVersion: {},
    severity: {},
  };
  const reasons = {};
  const llmAgreement = {
    agreed: 0,
    compared: 0,
    disagreed: 0,
  };

  records.forEach((record) => {
    addVerdict(overall, record.verdict);
    addToCohorts(cohortFields.baselineType, record.baselineType, record.verdict);
    addToCohorts(cohortFields.desiredDirection, record.desiredDirection, record.verdict);
    addToCohorts(cohortFields.impact, record.impact, record.verdict);
    addToCohorts(cohortFields.magnitude, record.magnitudeBucket, record.verdict);
    addToCohorts(cohortFields.monitorKind, record.monitorKind, record.verdict);
    addToCohorts(cohortFields.observedDirection, record.observedDirection, record.verdict);
    addToCohorts(cohortFields.policyVersion, record.policyVersion, record.verdict);
    addToCohorts(cohortFields.severity, record.severity, record.verdict);
    if (record.verdict === "not_relevant") {
      const reasonCode = record.reasonCode || "unspecified";
      reasons[reasonCode] = (reasons[reasonCode] || 0) + 1;
    }
    if (["relevant", "not_relevant"].includes(record.verdict)
      && record.auditRelevant !== null) {
      llmAgreement.compared += 1;
      const agreed = record.auditRelevant === (record.verdict === "relevant");
      llmAgreement[agreed ? "agreed" : "disagreed"] += 1;
    }
  });

  return {
    audits: summarizeAudits(audits),
    engagement: options.engagement || {},
    feedback: {
      cohorts: Object.fromEntries(Object.entries(cohortFields).map(([field, cohorts]) => (
        [field, finishCohorts(cohorts)]
      ))),
      falsePositiveReasons: reasons,
      featureAverages: {
        notRelevant: summarizeFeatures(records, "not_relevant"),
        relevant: summarizeFeatures(records, "relevant"),
      },
      llmAgreement: {
        ...llmAgreement,
        agreementRate: llmAgreement.compared
          ? round(llmAgreement.agreed / llmAgreement.compared)
          : null,
        lowSample: llmAgreement.compared < LOW_SAMPLE_THRESHOLD,
      },
      overall: finishCohort(overall),
    },
    generatedAt: (options.generatedAt || new Date()).toISOString(),
    limits: options.limits || {},
    reportVersion: REPORT_VERSION,
    usage: options.usage || {},
  };
}

module.exports = {
  LOW_SAMPLE_THRESHOLD,
  REPORT_VERSION,
  buildCalibrationReport,
  getMagnitudeBucket,
};
