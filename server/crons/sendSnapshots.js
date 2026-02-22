const cron = require("node-cron");
const { DateTime } = require("luxon");
const { Op } = require("sequelize");

const db = require("../models/models");

async function addSnapshotToQueue(queue, projectId) {
  const jobId = `snapshot_${projectId}`;
  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    return false;
  }
  await queue.add("sendSnapshot", { id: projectId }, { jobId });
  return true;
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

    const snapshotChecks = projects.map(async (project) => {
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

        // Check if we're past today's send time and haven't sent today yet
        const lastSnapshotToday = lastSnapshot && lastSnapshot.hasSame(sendTime, "day");
        shouldSend = now > sendTime && !lastSnapshotToday;
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
          // Find the most recent occurrence of the target weekday
          let sendTime = DateTime.now()
            .setZone(timezone)
            .set({
              hour: time.hour,
              minute: time.minute,
              second: 0,
              millisecond: 0,
              weekday: weekdayNumber
            });

          // If the target day is in the future this week, go back to last week
          if (sendTime > now) {
            sendTime = sendTime.minus({ weeks: 1 });
          }

          // Check if we're past this week's send time and haven't sent this week yet
          const lastSnapshotThisWeek = lastSnapshot && lastSnapshot.hasSame(sendTime, "week");
          shouldSend = now > sendTime && !lastSnapshotThisWeek;
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

    await Promise.all(snapshotChecks);
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
