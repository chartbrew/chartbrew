const fs = require("node:fs/promises");
const path = require("node:path");
const db = require("../../models/models");
const snapshots = require("../../modules/snapshots");
const { getIntegrationContext } = require("../../modules/observations/integrationContext");
const { assertCanViewProject, createHttpError, getObservationAccess } = require("../../modules/observations/access");
const { canExportChartImage } = require("../../modules/chartImage/imageAccess");
const { getPreview } = require("../../controllers/ChartPreviewController");

async function authorizeDashboard(projectId, teamId, userId) {
  const access = await getObservationAccess(teamId, userId);
  assertCanViewProject(access, projectId);
  const project = await db.Project.findOne({ where: { id: projectId, team_id: teamId, ghost: false } });
  if (!project) throw createHttpError("This dashboard is not available.", 403);
  if (userId != null) {
    const role = await db.TeamRole.findOne({ where: { team_id: teamId, user_id: userId } });
    if (!canExportChartImage(role, projectId)) throw createHttpError("Your Chartbrew account cannot export this dashboard.", 403);
  }
  const charts = await db.Chart.findAll({ where: { project_id: projectId, draft: false }, attributes: ["id"] });
  await Promise.all(charts.map((chart) => getPreview(chart.id, userId)));
  return project;
}

async function requestDashboardSnapshot(payload) {
  const context = getIntegrationContext();
  if (!context) throw createHttpError("Dashboard screenshots are available in Slack.", 400);
  const candidates = payload.project_id == null && context.resolveSnapshotProjectIds
    ? await context.resolveSnapshotProjectIds() : [];
  const projectId = payload.project_id ?? (candidates.length === 1 ? candidates[0] : null);
  if (!Number.isSafeInteger(projectId) || projectId < 1) {
    return { error: "Ask which dashboard to capture. Do not choose a dashboard without a clear target." };
  }
  if (payload.allowed_project_ids && !payload.allowed_project_ids.includes(projectId)) {
    throw createHttpError("This dashboard is not available.", 403);
  }
  const project = await authorizeDashboard(projectId, context.teamId, context.userId);
  return { projectId: project.id, name: project.name, status: "ready_for_delivery" };
}

async function sendDashboardSnapshot(snapshot, client, channel, threadTs, assertDeliveryAccess) {
  const authorize = async () => {
    const current = await assertDeliveryAccess();
    return authorizeDashboard(snapshot.projectId, current.access.teamId, current.account.user_id);
  };
  const project = await authorize();
  const file = await snapshots.snapDashboard(project);
  if (!file) throw new Error("The dashboard screenshot could not be created.");
  const filePath = path.resolve(__dirname, "../..", file);
  try {
    const image = await fs.readFile(filePath);
    await authorize();
    const response = await client.files.uploadV2({
      channel_id: channel, thread_ts: threadTs, file: image,
      filename: "dashboard.png", title: project.name,
    });
    const fileId = response.files?.[0]?.files?.[0]?.id || response.files?.[0]?.id;
    if (!fileId) throw new Error("Slack could not receive the dashboard screenshot.");
    return fileId;
  } finally {
    await fs.unlink(filePath).catch(() => {
      console.warn("Could not remove the temporary Slack dashboard screenshot."); // oxlint-disable-line no-console
    });
  }
}

module.exports = { authorizeDashboard, requestDashboardSnapshot, sendDashboardSnapshot };
