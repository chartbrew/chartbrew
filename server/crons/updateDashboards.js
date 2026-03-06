const cron = require("node-cron");
const { DateTime } = require("luxon");
const { Op } = require("sequelize");
const { Worker } = require("bullmq");
const path = require("path");

const db = require("../models/models");

const DASHBOARD_WORKER_LOCK_DURATION_MS = parseInt(
  process.env.CB_QUEUE_LOCK_DURATION_MS,
  10
) || 900000;
const DASHBOARD_WORKER_LOCK_RENEW_TIME_MS = parseInt(
  process.env.CB_QUEUE_LOCK_RENEW_TIME_MS,
  10
) || 60000;
const isQueueDebugEnabled = /^(1|true|yes|on)$/i.test(`${process.env.CB_QUEUE_DEBUG || ""}`);

function debugLog(message, details = null) {
  if (!isQueueDebugEnabled) {
    return;
  }

  if (details) {
    console.log(`[updateDashboards] ${message}`, details); // eslint-disable-line no-console
    return;
  }

  console.log(`[updateDashboards] ${message}`); // eslint-disable-line no-console
}

function buildJobId(entity, id) {
  return `${entity}_${id}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

async function addDashboardToQueue(queue, dashboardId) {
  const candidateJobId = buildJobId("dashboard", dashboardId);
  const job = await queue.add("updateDashboard", { id: dashboardId }, {
    jobId: candidateJobId,
    // Keep this in simple mode: enqueue only if no same dedupe key exists.
    // TTL+extend can starve 1-minute schedules when jobs are repeatedly deduped.
    deduplication: {
      id: `dashboard_${dashboardId}`,
    },
  });

  const returnedJobId = `${job.id}`;
  const deduplicated = returnedJobId !== candidateJobId;

  debugLog("queue.add", {
    dashboardId,
    candidateJobId,
    returnedJobId,
    deduplicated,
  });

  return {
    deduplicated,
    jobId: returnedJobId,
  };
}

async function updateDashboards(queue) {
  const tickStartedAt = Date.now();
  const conditions = {
    where: {
      updateSchedule: { [Op.ne]: "" }
    },
    attributes: ["id", "lastUpdatedAt", "updateSchedule"],
  };

  try {
    const dashboards = await db.Project.findAll(conditions);
    if (!dashboards || dashboards.length === 0) {
      debugLog("tick: no dashboards with updateSchedule");
      return;
    }

    let shouldUpdateCount = 0;
    let queuedCount = 0;
    let deduplicatedCount = 0;
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

      shouldUpdateCount += 1;
      debugLog("dashboard due", {
        dashboardId: dashboard.id,
        frequency,
        frequencyNumber,
        timezone,
        lastUpdatedAt: dashboard.lastUpdatedAt
          ? dashboard.lastUpdatedAt.toISOString()
          : null,
      });

      const result = await addDashboardToQueue(queue, dashboard.id);
      if (result.deduplicated) {
        deduplicatedCount += 1;
      } else {
        queuedCount += 1;
      }
    });

    await Promise.all(jobs);

    debugLog("tick summary", {
      totalDashboards: dashboards.length,
      shouldUpdateCount,
      queuedCount,
      deduplicatedCount,
      sampleSkippedDashboardIds: skippedDashboardIds,
      tickDurationMs: Date.now() - tickStartedAt,
    });
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
    concurrency: 5,
    lockDuration: DASHBOARD_WORKER_LOCK_DURATION_MS,
    lockRenewTime: Math.min(
      DASHBOARD_WORKER_LOCK_RENEW_TIME_MS,
      Math.floor(DASHBOARD_WORKER_LOCK_DURATION_MS / 2)
    ),
  });
}

module.exports = (queue) => {
  const worker = createWorker(queue);
  let isTickRunning = false;

  const runTick = async () => {
    if (isTickRunning) {
      debugLog("tick skipped (previous tick still running)");
      return;
    }

    isTickRunning = true;
    try {
      debugLog("tick started");
      await updateDashboards(queue);
    } finally {
      isTickRunning = false;
      debugLog("tick finished");
    }
  };

  runTick();

  cron.schedule("* * * * *", () => {
    runTick();
  });

  return worker;
};
