const db = require("../models/models");
const { getObservationAccess } = require("../modules/observations/access");
const {
  buildLearningSignalAuditReport,
} = require("../modules/workspaceContext/learningAuditReport");
const { cleanupWorkspaceLearning } = require("../modules/workspaceContext/retention");
const {
  getWorkspaceLearningProjection,
} = require("../modules/workspaceContext/workspaceLearningProjection");

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function getArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : null;
}

function getRequiredPositiveInteger(name) {
  const value = Number.parseInt(getArgument(name), 10);
  if (!Number.isInteger(value) || value < 1) {
    const error = new Error(`Use --${name}=<positive integer>`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

async function getSignalReport() {
  const teamId = getRequiredPositiveInteger("team-id");
  const userId = getRequiredPositiveInteger("user-id");
  const projectValue = getArgument("project-id");
  const projectId = projectValue === null
    ? null
    : getRequiredPositiveInteger("project-id");
  const access = await getObservationAccess(teamId, userId);
  const projection = await getWorkspaceLearningProjection(access, {
    ...(projectId ? { projectId } : {}),
  });
  return buildLearningSignalAuditReport(projection);
}

async function run() {
  try {
    const report = hasFlag("signals")
      ? await getSignalReport()
      : await cleanupWorkspaceLearning({
        actionAuditDays: process.env.CB_ORCHESTRATOR_ACTION_AUDIT_RETENTION_DAYS,
        batchSize: process.env.CB_DATA_RETENTION_BATCH_SIZE,
        dryRun: hasFlag("dry-run"),
      });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await db.sequelize.close();
  }
}

run().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || String(error)}\n`);
  process.exitCode = 1;
});
