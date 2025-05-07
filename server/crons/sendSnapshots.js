const cron = require("node-cron");
const { DateTime } = require("luxon");
const { Op } = require("sequelize");

const db = require("../models/models");

async function addSnapshotToQueue(queue, projectId) {
  const jobId = `snapshot_${projectId}`;
  await queue.add("sendSnapshot", { id: projectId }, { jobId });
}

async function checkSnapshots(queue) {
  const conditions = {
    where: {
      snapshotSchedule: { [Op.ne]: "" }
    },
    attributes: ["id", "lastSnapshotSentAt", "snapshotSchedule"],
  };

  try {
    const projects = await db.Project.findAll(conditions);
    if (!projects || projects.length === 0) {
      return;
    }

    projects.forEach(async (project) => {
      const {
        timezone,
        frequency,
        dayOfWeek,
        time,
        frequencyNumber,
      } = project.snapshotSchedule || {};

      const now = DateTime.now().setZone(timezone);
      const lastSnapshot = project.lastSnapshotSentAt
        ? DateTime.fromJSDate(project.lastSnapshotSentAt, { zone: timezone })
        : null;

      let shouldSend = false;

      if (!lastSnapshot) {
        shouldSend = true;
      } else if (frequency === "daily") {
        const sendTime = DateTime.now()
          .setZone(timezone)
          .set({
            hour: time.hour, minute: time.minute, second: 0, millisecond: 0
          });
        shouldSend = now > sendTime && now.diff(lastSnapshot, "days").as("days") >= 1;
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
          const sendTime = DateTime.now()
            .setZone(timezone)
            .set({
              hour: time.hour,
              minute: time.minute,
              second: 0,
              millisecond: 0,
              weekday: weekdayNumber
            });
          shouldSend = now > sendTime && now.diff(lastSnapshot, "weeks").as("weeks") >= 1;
        }
      } else if (frequency === "every_x_days") {
        shouldSend = now.diff(lastSnapshot, "days").as("days") >= frequencyNumber;
      } else if (frequency === "every_x_hours") {
        shouldSend = now.diff(lastSnapshot, "hours").as("hours") >= frequencyNumber;
      } else if (frequency === "every_x_minutes") {
        shouldSend = now.diff(lastSnapshot, "minutes").as("minutes") >= frequencyNumber;
      }

      if (shouldSend) {
        await addSnapshotToQueue(queue, project.id);
      }
    });
  } catch (error) {
    console.error(`Error checking and sending snapshots: ${error.message}`); // eslint-disable-line
  }
}

module.exports = (queue) => {
  checkSnapshots(queue);

  cron.schedule("* * * * *", () => {
    checkSnapshots(queue);
  });
};
