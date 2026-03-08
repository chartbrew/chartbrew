const cron = require("node-cron");
const { DateTime } = require("luxon");
const { Op } = require("sequelize");
const { Worker } = require("bullmq");
const path = require("path");

const db = require("../models/models");
const {
  completeRun,
  failRun,
  finishEvent,
  startEvent,
  startRun,
  updateRunContext,
} = require("../modules/updateAudit");

function parsePositiveInt(value, fallback) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

const BASE_DASHBOARD_WORKER_LOCK_DURATION_MS = parsePositiveInt(
  process.env.CB_DASHBOARD_QUEUE_LOCK_DURATION_MS,
  parsePositiveInt(process.env.CB_QUEUE_LOCK_DURATION_MS, 900000)
);
const DASHBOARD_WORKER_LOCK_DURATION_MS = Math.max(BASE_DASHBOARD_WORKER_LOCK_DURATION_MS, 300000);
const BASE_DASHBOARD_WORKER_LOCK_RENEW_TIME_MS = parsePositiveInt(
  process.env.CB_DASHBOARD_QUEUE_LOCK_RENEW_TIME_MS,
  parsePositiveInt(process.env.CB_QUEUE_LOCK_RENEW_TIME_MS, 60000)
);
const DASHBOARD_WORKER_LOCK_RENEW_TIME_MS = Math.max(
  10000,
  Math.min(
    BASE_DASHBOARD_WORKER_LOCK_RENEW_TIME_MS,
    Math.floor(DASHBOARD_WORKER_LOCK_DURATION_MS / 2)
  )
);
const DASHBOARD_WORKER_CONCURRENCY = Math.max(
  1,
  parsePositiveInt(process.env.CB_DASHBOARD_WORKER_CONCURRENCY, 2)
);
const isQueueDebugEnabled = /^(1|true|yes|on)$/i.test(`${process.env.CB_QUEUE_DEBUG || ""}`);

function buildJobId(entity, id) {
  return `${entity}_${id}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

async function addDashboardToQueue(queue, dashboard) {
  const dashboardId = dashboard.id;
  const traceContext = await startRun({
    triggerType: "dashboard_auto",
    entityType: "dashboard",
    status: "queued",
    teamId: dashboard.team_id || null,
    projectId: dashboardId,
    queueName: queue.name,
    summary: {
      frequency: dashboard.updateSchedule?.frequency || null,
      frequencyNumber: dashboard.updateSchedule?.frequencyNumber || null,
      timezone: dashboard.updateSchedule?.timezone || null,
    },
  });
  const queueEvent = await startEvent(traceContext, "queue_enqueued", {
    dashboardId,
    queueName: queue.name,
  });
  const candidateJobId = buildJobId("dashboard", dashboardId);
  try {
    const job = await queue.add("updateDashboard", {
      id: dashboardId,
      traceContext,
    }, {
      jobId: candidateJobId,
      // Keep this in simple mode: enqueue only if no same dedupe key exists.
      // TTL+extend can starve 1-minute schedules when jobs are repeatedly deduped.
      deduplication: {
        id: `dashboard_${dashboardId}`,
      },
    });

    const returnedJobId = `${job.id}`;
    const deduplicated = returnedJobId !== candidateJobId;
    traceContext.jobId = returnedJobId;
    traceContext.queueName = queue.name;

    await finishEvent(traceContext, queueEvent, deduplicated ? "deduplicated" : "success", {
      dashboardId,
      candidateJobId,
      returnedJobId,
      deduplicated,
    });
    await updateRunContext(traceContext, {
      jobId: returnedJobId,
      queueName: queue.name,
      status: deduplicated ? "deduplicated" : "queued",
    });

    if (deduplicated) {
      await completeRun(traceContext, {
        status: "deduplicated",
        summary: {
          dashboardId,
          deduplicated: true,
          candidateJobId,
          returnedJobId,
        },
      });
    }

    return {
      deduplicated,
      jobId: returnedJobId,
    };
  } catch (error) {
    await finishEvent(traceContext, queueEvent, "failed", {
      dashboardId,
      candidateJobId,
    });
    await failRun(traceContext, error, {
      stage: "queue",
      payload: {
        dashboardId,
        queueName: queue.name,
        candidateJobId,
      },
    });
    throw error;
  }
}

async function updateDashboards(queue) {
  const conditions = {
    where: {
      updateSchedule: { [Op.ne]: "" }
    },
    attributes: ["id", "team_id", "lastUpdatedAt", "updateSchedule"],
  };

  try {
    const dashboards = await db.Project.findAll(conditions);
    if (!dashboards || dashboards.length === 0) {
      return;
    }

    const skippedDashboardIds = [];

    const jobs = dashboards.map(async (dashboard) => {
      const {
        timezone,
        frequency,
        dayOfWeek,
        time,
        frequencyNumber,
      } = dashboard.updateSchedule || {};

      const now = DateTime.now().setZone(timezone);
      const lastUpdated = dashboard.lastUpdatedAt
        ? DateTime.fromJSDate(dashboard.lastUpdatedAt, { zone: timezone })
        : null;

      let shouldUpdate = false;

      if (!lastUpdated) {
        shouldUpdate = true;
      } else if (frequency === "daily") {
        const updateTime = DateTime.now()
          .setZone(timezone)
          .set({
            hour: time.hour,
            minute: time.minute,
            second: 0,
            millisecond: 0
          });
        shouldUpdate = now > updateTime && now.diff(lastUpdated, "days").as("days") >= 1;
      } else if (frequency === "weekly" && dayOfWeek) {
        let weekdayNumber;
        if (typeof dayOfWeek === "number") {
          weekdayNumber = dayOfWeek;
        } else if (typeof dayOfWeek === "string") {
          weekdayNumber = {
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
            sunday: 7
          }[dayOfWeek.toLowerCase()];
        }

        if (weekdayNumber) {
          const updateTime = DateTime.now()
            .setZone(timezone)
            .set({
              hour: time.hour,
              minute: time.minute,
              second: 0,
              millisecond: 0,
              weekday: weekdayNumber
            });
          shouldUpdate = now > updateTime && now.diff(lastUpdated, "weeks").as("weeks") >= 1;
        }
      } else if (frequency === "every_x_days") {
        shouldUpdate = now.diff(lastUpdated, "days").as("days") >= frequencyNumber;
      } else if (frequency === "every_x_hours") {
        shouldUpdate = now.diff(lastUpdated, "hours").as("hours") >= frequencyNumber;
      } else if (frequency === "every_x_minutes") {
        shouldUpdate = now.diff(lastUpdated, "minutes").as("minutes") >= frequencyNumber;
      }

      if (!shouldUpdate) {
        if (isQueueDebugEnabled && skippedDashboardIds.length < 10) {
          skippedDashboardIds.push(dashboard.id);
        }
        return;
      }

      await addDashboardToQueue(queue, dashboard);
    });

    await Promise.all(jobs);
  } catch (error) {
    console.error(`Error checking and updating dashboards: ${error.message}`); // eslint-disable-line
  }
}

function createWorker(queue) {
  return new Worker(queue.name, async (job) => {
    const updateDashboardPath = path.join(__dirname, "workers", "updateDashboard.js");
    const updateDashboard = require(updateDashboardPath); // eslint-disable-line
    await updateDashboard(job);
  }, {
    connection: queue.opts.connection,
    concurrency: DASHBOARD_WORKER_CONCURRENCY,
    lockDuration: DASHBOARD_WORKER_LOCK_DURATION_MS,
    lockRenewTime: DASHBOARD_WORKER_LOCK_RENEW_TIME_MS,
  });
}

module.exports = (queue) => {
  const worker = createWorker(queue);
  let isTickRunning = false;

  const runTick = async () => {
    if (isTickRunning) {
      return;
    }

    isTickRunning = true;
    try {
      await updateDashboards(queue);
    } finally {
      isTickRunning = false;
    }
  };

  runTick();

  cron.schedule("* * * * *", () => {
    runTick();
  });

  return worker;
};
