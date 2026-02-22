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
      const uploadsRoot = path.resolve(__dirname, "../../uploads");
      const previousSnapshotPath = path.resolve(__dirname, "../../", project.currentSnapshot);
      const isUploadSnapshot = previousSnapshotPath.startsWith(`${uploadsRoot}${path.sep}`);
      if (isUploadSnapshot && fs.existsSync(previousSnapshotPath)) {
        fs.unlinkSync(previousSnapshotPath);
      }
    }

    return true;
  } catch (error) {
    throw new Error(error);
  }
};
