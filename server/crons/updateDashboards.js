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
        dayOfWeek,
        time,
        frequencyNumber,
      } = dashboard.updateSchedule || {};

      let formattedTime;
      if (time?.hour !== undefined && time?.minute !== undefined) {
        formattedTime = `${time.hour.toString().padStart(2, "0")}:${time.minute.toString().padStart(2, "0")}`;
      }

      const now = DateTime.now().setZone(timezone);
      const lastUpdated = dashboard.lastUpdatedAt
        ? DateTime.fromJSDate(dashboard.lastUpdatedAt, { zone: timezone })
        : null;

      let shouldUpdate = false;

      if (!lastUpdated) {
        shouldUpdate = true;
      } else if (frequency === "daily") {
        const updateTime = DateTime.fromFormat(formattedTime, "HH:mm", { zone: timezone });
        shouldUpdate = now > updateTime && now.diff(lastUpdated, "days").as("days") >= 1;
      } else if (frequency === "weekly") {
        const weekdays = {
          1: 'monday',
          2: 'tuesday',
          3: 'wednesday',
          4: 'thursday',
          5: 'friday',
          6: 'saturday',
          7: 'sunday'
        };

        let luxonWeekday;

        if (typeof dayOfWeek === 'string') {
          const lowerDayOfWeek = dayOfWeek.toLowerCase();
          luxonWeekday = Object.keys(weekdays).find(
            key => weekdays[key] === lowerDayOfWeek
          );
        }

        if (!luxonWeekday) {
          luxonWeekday = Number(dayOfWeek);
          if (isNaN(luxonWeekday) || luxonWeekday < 1 || luxonWeekday > 7) {
            throw new Error("Invalid weekday. Must be a number (1-7) or a valid day name (e.g., 'monday').");
          }
        }

        const updateTime = DateTime.fromFormat(formattedTime, "HH:mm", { zone: timezone }).set({ weekday: luxonWeekday });
        shouldUpdate = now > updateTime && now.diff(lastUpdated, "weeks").as("weeks") >= 1;
      } else if (frequency === "every_x_days") {
        shouldUpdate = now.diff(lastUpdated, "days").as("days") >= frequencyNumber;
      } else if (frequency === "every_x_hours") {
        shouldUpdate = now.diff(lastUpdated, "hours").as("hours") >= frequencyNumber;
      } else if (frequency === "every_x_minutes") {
        shouldUpdate = now.diff(lastUpdated, "minutes").as("minutes") >= frequencyNumber;
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
