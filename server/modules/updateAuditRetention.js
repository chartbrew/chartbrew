const cron = require("node-cron");

const { cleanupExpiredRuns } = require("./updateAudit");
const { cleanupObservationData } = require("./observations/retention");

function getCleanupOptions() {
  return {
    retentionDays: process.env.CB_UPDATE_AUDIT_RETENTION_DAYS,
    failedRetentionDays: process.env.CB_UPDATE_AUDIT_FAILED_RETENTION_DAYS,
    batchSize: process.env.CB_DATA_RETENTION_BATCH_SIZE,
    maxRuntimeSeconds: process.env.CB_DATA_RETENTION_MAX_RUNTIME_SECONDS,
  };
}

async function runCleanup() {
  const options = getCleanupOptions();
  const updateRuns = await cleanupExpiredRuns(options);
  const observations = await cleanupObservationData({
    auditDays: process.env.CB_OBSERVATION_AUDIT_RETENTION_DAYS,
    batchSize: process.env.CB_DATA_RETENTION_BATCH_SIZE,
    maxRuntimeSeconds: process.env.CB_DATA_RETENTION_MAX_RUNTIME_SECONDS,
    evaluationDays: process.env.CB_METRIC_EVALUATION_RETENTION_DAYS,
    rawSnapshotDays: process.env.CB_METRIC_SNAPSHOT_RETENTION_DAYS,
    resolvedObservationDays: process.env.CB_OBSERVATION_RESOLVED_RETENTION_DAYS,
    rollupDays: process.env.CB_METRIC_ROLLUP_RETENTION_DAYS,
  });
  const report = { observations, updateRuns };
  console.info("[retention] Cleanup completed", report); // eslint-disable-line no-console
  return report;
}

module.exports = () => {
  const options = getCleanupOptions();
  if (`${options.retentionDays}` === "0") {
    console.warn("[retention] Successful update-run cleanup is disabled"); // eslint-disable-line no-console
  }
  if (`${options.failedRetentionDays}` === "0") {
    console.warn("[retention] Failed update-run cleanup is disabled"); // eslint-disable-line no-console
  }
  [
    ["Raw metric snapshots", process.env.CB_METRIC_SNAPSHOT_RETENTION_DAYS],
    ["Daily metric rollups", process.env.CB_METRIC_ROLLUP_RETENTION_DAYS],
    ["Resolved observations", process.env.CB_OBSERVATION_RESOLVED_RETENTION_DAYS],
    ["Observation audits", process.env.CB_OBSERVATION_AUDIT_RETENTION_DAYS],
    ["Metric evaluations", process.env.CB_METRIC_EVALUATION_RETENTION_DAYS],
  ].forEach(([label, value]) => {
    if (`${value}` === "0") {
      console.warn(`[retention] ${label} cleanup is disabled`); // eslint-disable-line no-console
    }
  });

  runCleanup().catch((error) => {
    console.error("[retention] Update-run cleanup failed", error.message); // eslint-disable-line no-console
  });

  cron.schedule("15 2 * * *", async () => {
    try {
      await runCleanup();
    } catch (error) {
      console.error("[retention] Update-run cleanup failed", error.message); // eslint-disable-line no-console
    }
  });

  return true;
};

module.exports.getCleanupOptions = getCleanupOptions;
module.exports.runCleanup = runCleanup;
