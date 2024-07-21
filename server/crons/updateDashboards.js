const cron = require("node-cron");
const { DateTime } = require("luxon");
const { Op } = require("sequelize");
const db = require("../models/models");

async function updateDashboard(dashboard) {
  console.log(`Updating dashboard with ID: ${dashboard.id}`); // eslint-disable-line
}

async function updateDashboards() {
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

    dashboards.forEach((dashboard) => {
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
      const lastUpdated = DateTime.fromISO(dashboard.lastUpdatedAt, { zone: timezone });

      let shouldUpdate = false;

      if (frequency === "daily") {
        const updateTime = DateTime.fromFormat(formattedTime, "HH:mm", { zone: timezone });
        shouldUpdate = now > updateTime && now.diff(lastUpdated, "days") >= 1;
      } else if (frequency === "weekly") {
        const updateTime = DateTime.fromFormat(formattedTime, "HH:mm", { zone: timezone }).set({ weekday: dayOfTheWeek });
        shouldUpdate = now > updateTime && now.diff(lastUpdated, "weeks") >= 1;
      } else if (frequency === "every_x_days") {
        shouldUpdate = now.diff(lastUpdated, "days") >= frequencyNumber;
      } else if (frequency === "every_x_hours") {
        shouldUpdate = now.diff(lastUpdated, "hours") >= frequencyNumber;
      } else if (frequency === "every_x_minutes") {
        shouldUpdate = now.diff(lastUpdated, "minutes") >= frequencyNumber;
      }

      if (shouldUpdate) {
        updateDashboard(dashboard);
      }
    });
  } catch (error) {
    console.error(`Error checking and updating dashboards: ${error.message}`); // eslint-disable-line
  }
}

cron.schedule("* * * * *", updateDashboards);

module.exports = updateDashboards;
