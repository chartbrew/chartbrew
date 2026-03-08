const { DateTime } = require("luxon");
const { Op } = require("sequelize");

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

function parsePositiveInt(value, fallback) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

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

const DASHBOARD_CHART_UPDATE_CONCURRENCY = parsePositiveInt(
  process.env.CB_DASHBOARD_CHART_UPDATE_CONCURRENCY,
  2
);

async function runWithConcurrency(items, workerFn, concurrency) {
  if (!items || items.length === 0) {
    return [];
  }

  const maxConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  const processNext = async () => {
    if (nextIndex >= items.length) {
      return;
    }

    const currentIndex = nextIndex;
    nextIndex += 1;
    results[currentIndex] = await workerFn(items[currentIndex]);
    await processNext();
  };

  const runners = Array.from({ length: maxConcurrency }, async () => processNext());

  await Promise.all(runners);
  return results;
}

async function ensureTraceContext(dashboard, job) {
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

  return startRun({
    triggerType: "dashboard_auto",
    entityType: "dashboard",
    status: "running",
    teamId: dashboard.team_id || null,
    projectId: dashboard.id,
    queueName: job.queueName,
    jobId: `${job.id}`,
  });
}

async function updateChart(chart, dashboard, dashboardTraceContext) {
  const chartTraceContext = await startRun({
    triggerType: dashboardTraceContext?.triggerType || "dashboard_auto",
    entityType: "chart",
    status: "running",
    teamId: dashboardTraceContext?.teamId || dashboard.team_id || null,
    projectId: dashboard.id,
    chartId: chart.id,
  }, dashboardTraceContext);

  try {
    const chartData = await chartController.updateChartData(chart.id, null, {
      traceContext: chartTraceContext,
      finalizeRun: false,
    });
    checkChartForAlerts(chartData);
    await completeRun(chartTraceContext, {
      status: "success",
      summary: {
        chartId: chart.id,
        dashboardId: dashboard.id,
        chartDataUpdatedAt: chartData?.chartDataUpdated || null,
      },
    });

    return {
      success: true,
      chartId: chart.id,
    };
  } catch (error) {
    await failRun(chartTraceContext, error, {
      stage: error.auditStage || "unknown",
      payload: {
        chartId: chart.id,
        dashboardId: dashboard.id,
      },
      summary: {
        chartId: chart.id,
        dashboardId: dashboard.id,
      },
    });

    return {
      success: false,
      chartId: chart.id,
      error: error.message,
      errorStage: error.auditStage || "unknown",
    };
  }
}

module.exports = async (job) => {
  const dashboardData = job.data?.dashboard || job.data;
  const dashboard = dashboardData.dataValues ? dashboardData.dataValues : dashboardData;
  const rootTraceContext = await ensureTraceContext(dashboard, job);

  await recordInstantEvent(rootTraceContext, "worker_started", {
    dashboardId: dashboard.id,
    queueName: job.queueName,
    jobId: `${job.id}`,
    attemptsMade: job.attemptsMade || 0,
  });

  try {
    const charts = await db.Chart.findAll({
      where: { project_id: dashboard.id, type: { [Op.not]: "markdown" } },
      attributes: ["id"],
    });

    const chartResults = await runWithConcurrency(
      charts,
      (chart) => updateChart(chart, dashboard, rootTraceContext),
      DASHBOARD_CHART_UPDATE_CONCURRENCY
    );

    try {
      await db.Project.update(
        { lastUpdatedAt: DateTime.now().toJSDate() },
        { where: { id: dashboard.id } }
      );
    } catch (error) {
      throw toAuditError(error, "persist");
    }

    const failureCount = chartResults.filter((result) => result && result.success === false).length;
    const successCount = chartResults.filter((result) => result && result.success === true).length;

    await completeRun(rootTraceContext, {
      status: failureCount > 0 ? "partial_failure" : "success",
      summary: {
        dashboardId: dashboard.id,
        chartCount: charts.length,
        successCount,
        failureCount,
      },
      payload: {
        dashboardId: dashboard.id,
        chartCount: charts.length,
      },
    });

    return true;
  } catch (error) {
    const wrappedError = toAuditError(error, error.auditStage || "unknown");
    await failRun(rootTraceContext, wrappedError, {
      stage: wrappedError.auditStage || "unknown",
      payload: {
        dashboardId: dashboard.id,
        queueName: job.queueName,
        jobId: `${job.id}`,
      },
      summary: {
        dashboardId: dashboard.id,
      },
    });
    throw wrappedError;
  }
};
