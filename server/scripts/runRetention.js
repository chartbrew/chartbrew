const db = require("../models/models");
const { cleanupExpiredRuns } = require("../modules/updateAudit");
const { cleanupObservationData } = require("../modules/observations/retention");
const { cleanupWorkspaceLearning } = require("../modules/workspaceContext/retention");

function readOption(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length) : undefined;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function run() {
  const category = readOption("category") || "all";
  if (!["all", "observations", "update-runs", "workspace-learning"].includes(category)) {
    throw new Error(`Unknown retention category: ${category}`);
  }

  try {
    const sharedOptions = {
      batchSize: process.env.CB_DATA_RETENTION_BATCH_SIZE,
      dryRun: hasFlag("dry-run"),
      limit: readOption("limit"),
      maxRuntimeSeconds: process.env.CB_DATA_RETENTION_MAX_RUNTIME_SECONDS,
    };
    const report = {};
    if (["all", "update-runs"].includes(category)) {
      report.updateRuns = await cleanupExpiredRuns({
        ...sharedOptions,
        failedRetentionDays: process.env.CB_UPDATE_AUDIT_FAILED_RETENTION_DAYS,
        retentionDays: process.env.CB_UPDATE_AUDIT_RETENTION_DAYS,
      });
    }
    if (["all", "observations"].includes(category)) {
      report.observations = await cleanupObservationData({
        ...sharedOptions,
        auditDays: process.env.CB_OBSERVATION_AUDIT_RETENTION_DAYS,
        evaluationDays: process.env.CB_METRIC_EVALUATION_RETENTION_DAYS,
        rawSnapshotDays: process.env.CB_METRIC_SNAPSHOT_RETENTION_DAYS,
        resolvedObservationDays: process.env.CB_OBSERVATION_RESOLVED_RETENTION_DAYS,
        rollupDays: process.env.CB_METRIC_ROLLUP_RETENTION_DAYS,
      });
    }
    if (["all", "workspace-learning"].includes(category)) {
      report.workspaceLearning = await cleanupWorkspaceLearning({
        ...sharedOptions,
        actionAuditDays: process.env.CB_ORCHESTRATOR_ACTION_AUDIT_RETENTION_DAYS,
      });
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await db.sequelize.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
});
