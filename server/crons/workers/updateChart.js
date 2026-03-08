const moment = require("moment");

const ChartController = require("../../controllers/ChartController");
const db = require("../../models/models");
const { checkChartForAlerts } = require("../../modules/alerts/checkAlerts");
const {
  completeRun,
  failRun,
  recordInstantEvent,
  startRun,
  updateRunContext,
} = require("../../modules/updateAudit");

const chartController = new ChartController();

function toAuditError(error, stage = "unknown") {
  if (error instanceof Error) {
    const wrappedError = error;
    wrappedError.auditStage = wrappedError.auditStage || stage;
    return wrappedError;
  }

  const wrappedError = new Error(String(error));
  wrappedError.auditStage = stage;
  return wrappedError;
}

async function ensureTraceContext(chart, job) {
  const existingTraceContext = job?.data?.traceContext || null;
  if (existingTraceContext) {
    existingTraceContext.jobId = `${job.id}`;
    existingTraceContext.queueName = job.queueName;
    await updateRunContext(existingTraceContext, {
      status: "running",
      jobId: `${job.id}`,
      queueName: job.queueName,
    });
    return existingTraceContext;
  }

  const project = chart.project_id
    ? await db.Project.findByPk(chart.project_id, { attributes: ["team_id"] })
    : null;

  return startRun({
    triggerType: "chart_auto",
    entityType: "chart",
    status: "running",
    teamId: project?.team_id || null,
    projectId: chart.project_id || null,
    chartId: chart.id,
    queueName: job.queueName,
    jobId: `${job.id}`,
  });
}

async function updateDate(chart) {
  if (moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment())) {
    try {
      await chartController.update(chart.id, { lastAutoUpdate: moment() });
      return true;
    } catch (error) {
      throw toAuditError(error, "persist");
    }
  }

  return true;
}

async function runUpdate(chart, traceContext) {
  try {
    const chartData = await chartController.updateChartData(chart.id, null, {
      traceContext,
      finalizeRun: false,
    });
    checkChartForAlerts(chartData);
    const dateUpdated = await updateDate(chart);
    if (!dateUpdated) {
      throw toAuditError(`Failed to update date for chart ${chart.id}`, "persist");
    }
    return chartData;
  } catch (error) {
    throw toAuditError(error, error.auditStage || "unknown");
  }
}

module.exports = async (job) => {
  const chartData = job.data?.chart || job.data;
  const chartToUpdate = chartData.dataValues ? chartData.dataValues : chartData;
  const traceContext = await ensureTraceContext(chartToUpdate, job);

  await recordInstantEvent(traceContext, "worker_started", {
    chartId: chartToUpdate.id,
    queueName: job.queueName,
    jobId: `${job.id}`,
    attemptsMade: job.attemptsMade || 0,
  });

  try {
    const dateUpdated = await updateDate(chartToUpdate);
    if (!dateUpdated) {
      throw toAuditError(`Failed to update date for chart ${chartToUpdate.id}`, "persist");
    }

    const updatedChart = await runUpdate(chartToUpdate, traceContext);
    await completeRun(traceContext, {
      status: "success",
      summary: {
        chartId: chartToUpdate.id,
        chartDataUpdatedAt: updatedChart?.chartDataUpdated || null,
      },
    });
    return true;
  } catch (error) {
    await failRun(traceContext, error, {
      stage: error.auditStage || "unknown",
      payload: {
        chartId: chartToUpdate.id,
        queueName: job.queueName,
        jobId: `${job.id}`,
      },
      summary: {
        chartId: chartToUpdate.id,
      },
    });
    throw toAuditError(error, error.auditStage || "unknown");
  }
};
