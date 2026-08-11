const _ = require("lodash");

const DatasetController = require("../../controllers/DatasetController");
const db = require("../../models/models");

const MAX_DIMENSIONS = 3;
const MAX_ROWS = 5000;
const MAX_SEGMENTS = 50;
const MAX_RESULTS = 5;
const QUERY_TIMEOUT_MS = 10000;
const RECONCILIATION_TOLERANCE = 0.02;

const datasetController = new DatasetController();

function stripRoot(fieldPath) {
  return `${fieldPath || ""}`
    .replace(/^root\[\]\.?/, "")
    .replace(/^root\.?/, "")
    .replace(/\[\]/g, "");
}

function findRows(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const queue = [value];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const key of Object.keys(current || {}).sort()) {
      const child = current[key];
      if (Array.isArray(child)) return child;
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return [];
}

function getValue(row, fieldPath) {
  return _.get(row, stripRoot(fieldPath));
}

function inPeriod(row, timeField, period) {
  const date = new Date(getValue(row, timeField));
  if (Number.isNaN(date.getTime())) return false;
  return date >= new Date(period.start) && date < new Date(period.end);
}

function aggregateRows(rows, metricField, aggregate) {
  if (aggregate === "count") {
    if (!metricField) return rows.length;
    return rows.filter((row) => {
      const value = getValue(row, metricField);
      return value !== null && value !== undefined;
    }).length;
  }
  const values = rows
    .map((row) => Number(getValue(row, metricField)))
    .filter(Number.isFinite);
  if (values.length === 0) return 0;
  if (aggregate === "sum") return values.reduce((total, value) => total + value, 0);
  return null;
}

function isReconciled(actual, expected) {
  const allowedDifference = Math.max(Math.abs(expected) * RECONCILIATION_TOLERANCE, 0.000001);
  return Math.abs(actual - expected) <= allowedDifference;
}

function analyzeDimension(rows, observation, monitor, dimension) {
  const metricSpec = monitor.metric_spec || {};
  if (!["count", "sum"].includes(metricSpec.aggregate)) return null;
  if (!metricSpec.timeField) return null;

  const currentRows = rows.filter((row) => {
    return inPeriod(row, metricSpec.timeField, {
      end: observation.current_period_end,
      start: observation.current_period_start,
    });
  });
  const comparisonRows = rows.filter((row) => {
    return inPeriod(row, metricSpec.timeField, {
      end: observation.comparison_period_end,
      start: observation.comparison_period_start,
    });
  });
  if (currentRows.length === 0 || comparisonRows.length === 0) return null;

  const segments = new Set([...currentRows, ...comparisonRows].map((row) => {
    const value = getValue(row, dimension);
    return value === null || value === undefined || value === "" ? "Unknown" : `${value}`;
  }));
  if (segments.size < 2 || segments.size > MAX_SEGMENTS) return null;

  const results = [...segments].map((segment) => {
    const matchesSegment = (row) => {
      const value = getValue(row, dimension);
      const label = value === null || value === undefined || value === "" ? "Unknown" : `${value}`;
      return label === segment;
    };
    const current = aggregateRows(
      currentRows.filter(matchesSegment),
      metricSpec.metricField,
      metricSpec.aggregate,
    );
    const comparison = aggregateRows(
      comparisonRows.filter(matchesSegment),
      metricSpec.metricField,
      metricSpec.aggregate,
    );
    return {
      comparison,
      current,
      delta: current - comparison,
      segment,
    };
  });
  const currentTotal = results.reduce((total, item) => total + item.current, 0);
  const comparisonTotal = results.reduce((total, item) => total + item.comparison, 0);
  if (
    !isReconciled(currentTotal, Number(observation.current_value))
    || !isReconciled(comparisonTotal, Number(observation.baseline_value))
  ) {
    return null;
  }

  const absoluteMovement = results.reduce((total, item) => total + Math.abs(item.delta), 0);
  const ranked = results
    .filter((item) => item.delta !== 0)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, MAX_RESULTS)
    .map((item) => ({
      ...item,
      movementShare: absoluteMovement > 0 ? Math.abs(item.delta) / absoluteMovement : 0,
    }));
  if (ranked.length === 0) return null;

  return {
    dimension: stripRoot(dimension).replace(/[_.]/g, " "),
    segments: ranked,
  };
}

function selectDimensions(monitor, intelligence) {
  const approved = monitor.metric_spec?.approvedBreakdownDimensions;
  if (Array.isArray(approved) && approved.length > 0) {
    return approved.filter((field) => typeof field === "string").slice(0, MAX_DIMENSIONS);
  }
  const profile = intelligence?.profile;
  const candidates = Array.isArray(profile?.monitoring?.candidateSegments)
    ? profile.monitoring.candidateSegments
    : [];
  return candidates
    .map((candidate) => candidate.field)
    .filter((field) => {
      const definition = profile.fields?.[field];
      const cardinality = profile.quality?.cardinality?.[field];
      return definition?.role === "dimension"
        && Number(definition.confidence) >= 0.9
        && Number(cardinality) >= 2
        && Number(cardinality) <= MAX_SEGMENTS;
    })
    .slice(0, MAX_DIMENSIONS);
}

function insufficientEvidence() {
  return {
    message: "There is not enough evidence to compare segments for this change.",
    status: "not_enough_evidence",
  };
}

function withTimeout(promise, timeoutMs) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Driver analysis timed out")), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

async function runDriverAnalysis(observation) {
  const monitor = observation.MetricMonitor;
  if (!monitor?.dataset_id || !["count", "sum"].includes(monitor.metric_spec?.aggregate)) {
    return insufficientEvidence();
  }
  const intelligence = await db.DatasetIntelligence.findOne({
    where: {
      dataset_id: monitor.dataset_id,
      status: "ready",
      team_id: observation.team_id,
    },
  });
  const dimensions = selectDimensions(monitor, intelligence);
  if (dimensions.length === 0) return insufficientEvidence();

  let result;
  try {
    result = await withTimeout(
      datasetController.runRequest({
        dataset_id: monitor.dataset_id,
        getCache: true,
        team_id: observation.team_id,
        viewerScope: `observation-${observation.id}`,
      }),
      QUERY_TIMEOUT_MS,
    );
  } catch (error) {
    return insufficientEvidence();
  }
  const allRows = findRows(result?.data);
  if (allRows.length === 0 || allRows.length > MAX_ROWS) return insufficientEvidence();

  for (const dimension of dimensions) {
    const analysis = analyzeDimension(allRows, observation, monitor, dimension);
    if (analysis) {
      return {
        ...analysis,
        message: `The change is concentrated in ${analysis.segments[0].segment}.`,
        status: "ready",
      };
    }
  }
  return insufficientEvidence();
}

module.exports = {
  analyzeDimension,
  findRows,
  runDriverAnalysis,
  selectDimensions,
};
