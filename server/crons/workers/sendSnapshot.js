const { DateTime } = require("luxon");
const mail = require("../../modules/mail");
const webhookAlerts = require("../../modules/alerts/webhookAlerts");
const { snapDashboard } = require("../../modules/snapshots");

const db = require("../../models/models");
const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const fullApiUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_API_HOST : process.env.VITE_APP_API_HOST_DEV;

async function sendSnapshotToEmail(project, snapshotPath, customEmails) {
  if (!project.snapshotSchedule?.mediums?.email?.enabled) {
    return;
  }

  const recipients = customEmails || [];
  const dashboardUrl = `${settings.client}/b/${project.brewName}`;
  const snapshotUrl = `${fullApiUrl}/${snapshotPath}`;

  await mail.sendDashboardSnapshot({
    projectName: project.name,
    recipients,
    dashboardUrl,
    snapshotUrl,
  });
}

async function sendSnapshotToIntegrations(project, snapshotPath, integrations) {
  if (!integrations || integrations.length === 0) {
    return;
  }

  const dashboardUrl = `${settings.client}/b/${project.brewName}`;
  const snapshotUrl = `${fullApiUrl}/${snapshotPath}`;

  const integrationPromises = integrations.map(async (integration) => {
    if (integration.type === "webhook") {
      const blocks = [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:camera: New dashboard snapshot for *${project.name}*`,
        },
      }, {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "A new snapshot of your dashboard has been generated.",
        },
      }, {
        type: "divider",
      }, {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `<${dashboardUrl}|*View your dashboard*>`,
        }
      }];

      // localhost is not a valid url for the image_url
      if (snapshotUrl && snapshotUrl?.indexOf("localhost") === -1) {
        blocks.push({
          type: "image",
          image_url: snapshotUrl,
          alt_text: `${project.name} snapshot`,
        });
      }

      return webhookAlerts.send({
        integration,
        project,
        snapshotUrl,
        blocks: integration.config.slackMode ? blocks : [],
      });
    }

    return null;
  });

  await Promise.all(integrationPromises);
}

module.exports = async (job) => {
  try {
    const project = await db.Project.findByPk(job.data.id);
    if (!project) {
      throw new Error("Project not found");
    }

    // Take the snapshot
    const snapshotPath = await snapDashboard(project, true, {
      viewport: project.snapshotSchedule?.viewport,
      theme: project.snapshotSchedule?.theme,
    });

    if (!snapshotPath) {
      throw new Error("Failed to take snapshot");
    }

    // Send to configured channels
    await sendSnapshotToEmail(project, snapshotPath, project.snapshotSchedule?.customEmails);
    await sendSnapshotToIntegrations(project, snapshotPath, project.snapshotSchedule?.integrations);

    // Update last snapshot sent time
    await db.Project.update(
      { lastSnapshotSentAt: DateTime.now().toJSDate() },
      { where: { id: project.id } }
    );

    return true;
  } catch (error) {
    throw new Error(error);
  }
};
