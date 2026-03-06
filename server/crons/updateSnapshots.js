const cron = require("node-cron");

const db = require("../models/models");

function buildJobId(entity, id) {
  return `${entity}_${id}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

async function addSnapshotToQueue(queue, project) {
  await queue.add("takeSnapshot", project, {
    jobId: buildJobId("update_snapshot", project.id),
    deduplication: {
      id: `update_snapshot_${project.id}`,
    },
  });
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

module.exports = (queue) => {
  let isTickRunning = false;

  const runTick = async () => {
    if (isTickRunning) {
      return;
    }

    isTickRunning = true;
    try {
      await updateSnapshots(queue);
    } finally {
      isTickRunning = false;
    }
  };

  runTick();

  // Run at 2 AM every day
  cron.schedule("0 2 * * *", () => {
    runTick();
  });
};
