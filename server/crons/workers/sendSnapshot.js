const { Op } = require("sequelize");
const request = require("request-promise");
const { DateTime } = require("luxon");
const path = require("path");
const fs = require("fs");

const mail = require("../../modules/mail");
const { snapDashboard } = require("../../modules/snapshots");
const db = require("../../models/models");

const settings = process.env.NODE_ENV === "production" ? require("../../settings") : require("../../settings-dev");

const fullApiUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_API_HOST : process.env.VITE_APP_API_HOST_DEV;

async function sendToWebhook({
  project, snapshotUrl, blocks, integration
}) {
  const options = {
    url: integration.config.url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      project: project.name,
      snapshotUrl,
      blocks,
    }),
  };

  const response = await request(options);

  return response;
}

async function sendSnapshotToEmail(project, snapshotPath, customEmails) {
  if (!project.snapshotSchedule?.mediums?.email?.enabled) {
    return false;
  }

  const recipients = (customEmails || []).filter(Boolean);
  if (recipients.length === 0) {
    return false;
  }

  const dashboardUrl = `${settings.client}/dashboard/${project.id}`;
  const snapshotUrl = `${fullApiUrl}/${snapshotPath}`;
  const snapshotAbsolutePath = path.resolve(__dirname, "../../", snapshotPath);
  const attachments = [];

  if (fs.existsSync(snapshotAbsolutePath)) {
    attachments.push({
      filename: path.basename(snapshotAbsolutePath),
      path: snapshotAbsolutePath,
    });
  }

  await mail.sendDashboardSnapshot({
    projectName: project.name,
    recipients,
    dashboardUrl,
    snapshotUrl,
    attachments,
  });

  return true;
}

async function sendSnapshotToIntegrations(project, snapshotPath, integrations) {
  if (!integrations || integrations.length === 0) {
    return {
      sent: 0,
      failed: 0,
      errors: [],
    };
  }

  const dashboardUrl = `${settings.client}/dashboard/${project.id}`;
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
        type: "divider",
      }, {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `<${dashboardUrl}|*View live dashboard*>`,
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

      try {
        await sendToWebhook({
          integration,
          project,
          snapshotUrl,
          blocks: integration.config.slackMode ? blocks : [],
        });
        return { sent: true };
      } catch (error) {
        return { sent: false, error };
      }
    }

    return { sent: false };
  });

  const integrationResults = await Promise.all(integrationPromises);

  const summary = integrationResults.reduce((acc, item) => {
    if (item?.sent) {
      acc.sent += 1;
    } else if (item?.error) {
      acc.failed += 1;
      acc.errors.push(item.error);
    }
    return acc;
  }, { sent: 0, failed: 0, errors: [] });

  return summary;
}

module.exports = async (job) => {
  const project = await db.Project.findByPk(job.data.id);
  if (!project) {
    throw new Error("Project not found");
  }

  // Take the snapshot
  const snapshotPath = await snapDashboard(project, project.snapshotSchedule);

  if (!snapshotPath) {
    throw new Error("Failed to take snapshot");
  }

  let integrations = [];
  if (project.snapshotSchedule?.integrations) {
    integrations = await db.Integration.findAll({
      where: {
        id: {
          [Op.in]: project.snapshotSchedule?.integrations?.map((i) => i.integration_id),
        },
      },
    });
  }

  let sentToAtLeastOneChannel = false;
  let firstSendError = null;

  try {
    const emailSent = await sendSnapshotToEmail(
      project,
      snapshotPath,
      project.snapshotSchedule?.customEmails
    );
    if (emailSent) {
      sentToAtLeastOneChannel = true;
    }
  } catch (error) {
    firstSendError = firstSendError || error;
  }

  if (integrations.length > 0) {
    const integrationSummary = await sendSnapshotToIntegrations(
      project,
      snapshotPath,
      integrations
    );
    if (integrationSummary.sent > 0) {
      sentToAtLeastOneChannel = true;
    }
    if (!firstSendError && integrationSummary.errors.length > 0) {
      [firstSendError] = integrationSummary.errors;
    }
  }

  const hasConfiguredEmail = !!project.snapshotSchedule?.mediums?.email?.enabled;
  const hasConfiguredIntegrations = integrations.length > 0;

  if ((hasConfiguredEmail || hasConfiguredIntegrations) && !sentToAtLeastOneChannel) {
    throw firstSendError || new Error("No snapshot channels succeeded");
  }

  // Update last snapshot sent time
  await db.Project.update(
    { lastSnapshotSentAt: DateTime.now().toJSDate(), currentSnapshot: snapshotPath },
    { where: { id: project.id } }
  );

  return true;
};
