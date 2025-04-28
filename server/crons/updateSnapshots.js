const cron = require("node-cron");
const { DateTime } = require("luxon");

const db = require("../models/models");

async function addSnapshotToQueue(queue, project) {
  const jobId = `update_snapshot_${project.id}`;

  await queue.add("takeSnapshot", project, { jobId });
}

async function updateSnapshots(queue) {
  try {
    const projects = await db.Project.findAll({
      where: {
        ghost: false,
      },
      attributes: ["id", "brewName", "currentSnapshot"],
      include: [{
        model: db.Chart,
        attributes: ["id"],
        required: true,
        where: {
          onReport: true,
        },
      }]
    });

    if (!projects || projects.length === 0) {
      return;
    }

    // Add each project to the queue for snapshot update
    const promises = projects.map((project) => {
      if (project?.dataValues && project.dataValues.Charts?.length >= 1) {
        return addSnapshotToQueue(queue, project.dataValues);
      }

      return null;
    });
    await Promise.all(promises);
  } catch (error) {
    console.error(`Error updating snapshots: ${error.message}`); // eslint-disable-line
  }
}

async function checkActiveJobs(worker) {
  try {
    const activeJobs = await worker.getJobs(["active"]);

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

module.exports = (queue, worker) => {
  checkActiveJobs(worker);
  // Run at 2 AM every day
  cron.schedule("0 2 * * *", () => {
    updateSnapshots(queue);
  });
};
