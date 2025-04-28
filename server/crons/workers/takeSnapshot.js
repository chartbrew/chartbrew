const path = require("path");
const fs = require("fs");

const { snapDashboard } = require("../../modules/snapshots");
const db = require("../../models/models");

module.exports = async (job) => {
  try {
    const project = job.data;

    // Take the snapshot
    const snapshotPath = await snapDashboard(project, { removeStyling: true, removeHeader: true });

    if (!snapshotPath) {
      throw new Error("Failed to take snapshot");
    }

    // Update current snapshot path
    await db.Project.update(
      { currentSnapshot: snapshotPath },
      { where: { id: project.id } }
    );

    // remove the previous snapshot
    if (project.currentSnapshot) {
      const previousSnapshotPath = path.join(__dirname, `../../uploads/snapshots/${project.currentSnapshot}`);
      if (fs.existsSync(previousSnapshotPath)) {
        fs.unlinkSync(previousSnapshotPath);
      }
    }

    return true;
  } catch (error) {
    throw new Error(error);
  }
};
