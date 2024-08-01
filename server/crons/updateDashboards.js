const cron = require("node-cron");
const { DateTime } = require("luxon");
const { Op } = require("sequelize");
const { Worker } = require("bullmq");
const path = require("path");

const db = require("../models/models");

async function addDashboardToQueue(queue, dashboardId) {
  const jobId = `dashboard_${dashboardId}`;
  await queue.add("updateDashboard", { id: dashboardId }, { jobId });
}

async function updateDashboards(queue) {
  const conditions = {
    where: {
      updateSchedule: { [Op.ne]: "" }
    },
    attributes: ["id", "lastUpdatedAt", "updateSchedule"],
  };

  try {
    const dashboards = await db.Project.findAll(conditions);
    if (!dashboards || dashboards.length === 0) {
      return;
    }

    dashboards.forEach(async (dashboard) => {
      const {
        timezone,
        frequency,
        dayOfTheWeek,
        time,
        frequencyNumber,
      } = dashboard.updateSchedule;

      let formattedTime;
      if (time?.hour && time?.minute) {
        formattedTime = `${time.hour}:${time.minute}`;
      }

      const now = DateTime.now().setZone(timezone);
      const lastUpdated = dashboard.lastUpdatedAt
        ? DateTime.fromJSDate(dashboard.lastUpdatedAt, { zone: timezone })
        : null;

      let shouldUpdate = false;

      if (!lastUpdated) {
        shouldUpdate = true;
      } else if (frequency === "daily") {
        if (formattedTime) {
          const updateTime = DateTime
            .fromFormat(formattedTime, DateTime.TIME_24_SIMPLE, { zone: timezone })
            .set({ weekday: dayOfTheWeek });
          shouldUpdate = now > updateTime && now.diff(lastUpdated, "days") >= 1;
        } else {
          shouldUpdate = now.diff(lastUpdated, "days") >= 1;
        }
      } else if (frequency === "weekly") {
        if (formattedTime && dayOfTheWeek) {
          const updateTime = DateTime
            .fromFormat(formattedTime, DateTime.TIME_24_SIMPLE, { zone: timezone })
            .set({ weekday: dayOfTheWeek });
          shouldUpdate = now > updateTime && now.diff(lastUpdated, "weeks") >= 1;
        } else {
          shouldUpdate = now.diff(lastUpdated, "weeks") >= 1;
        }
      } else if (frequency === "every_x_days") {
        shouldUpdate = now.diff(lastUpdated, "days") >= frequencyNumber;
      } else if (frequency === "every_x_hours") {
        shouldUpdate = now.diff(lastUpdated, "hours") >= frequencyNumber;
      } else if (frequency === "every_x_minutes") {
        shouldUpdate = now.diff(lastUpdated, "minutes") >= frequencyNumber;
      }

      if (shouldUpdate) {
        await addDashboardToQueue(queue, dashboard.id);
      }
    });
  } catch (error) {
    console.error(`Error checking and updating dashboards: ${error.message}`); // eslint-disable-line
  }
}

async function checkActiveJobs(updateChartsQueue) {
  try {
    const activeJobs = await updateChartsQueue.getJobs(["active"]);

    const jobPromises = activeJobs.map(async (job) => {
      const jobTimestamp = DateTime.fromMillis(job.timestamp);
      const currentTime = DateTime.now();
      const duration = currentTime.diff(jobTimestamp);
      const minutes = duration.as("minutes");
      if (minutes > 5) {
        await job.moveToFailed({ message: "Job manually failed due to being stuck" });
        await job.remove();
      }
    });

    await Promise.all(jobPromises);
  } catch (err) {
    //
  }
}

function createWorker(queue) {
  return new Worker(queue.name, async (job) => {
    const updateDashboardPath = path.join(__dirname, "workers", "updateDashboard.js");
    const updateDashboard = require(updateDashboardPath); // eslint-disable-line
    await updateDashboard(job);
  }, { connection: queue.opts.connection, concurrency: 5 });
}

module.exports = (queue) => {
  const worker = createWorker(queue);
  updateDashboards(queue);
  checkActiveJobs(worker);

  cron.schedule("* * * * *", () => {
    updateDashboards(queue);
  });
};
