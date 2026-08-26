const db = require("../../models/models");

const { ChartImageError } = require("./imageResponse");

const TEAM_ROLES = new Set(["teamAdmin", "teamOwner"]);
const PROJECT_ROLES = new Set(["projectAdmin", "projectEditor", "projectViewer"]);

function parseResourceId(value) {
  if (!/^[1-9]\d*$/.test(`${value || ""}`)) throw new ChartImageError("RESOURCE_NOT_FOUND");
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new ChartImageError("RESOURCE_NOT_FOUND");
  return id;
}

function canExportChartImage(teamRole, projectId) {
  if (!teamRole?.role) return false;
  if (TEAM_ROLES.has(teamRole.role)) return true;
  if (!PROJECT_ROLES.has(teamRole.role) || teamRole.canExport !== true) return false;
  return Array.isArray(teamRole.projects)
    && teamRole.projects.some((id) => `${id}` === `${projectId}`);
}

async function authorizeChartImage({ chartId, projectId, userId }, dependencies = {}) {
  const models = dependencies.db || db;
  const normalizedProjectId = parseResourceId(projectId);
  const normalizedChartId = parseResourceId(chartId);
  const project = await models.Project.findOne({
    attributes: ["id", "team_id"],
    where: { id: normalizedProjectId },
  });
  if (!project) throw new ChartImageError("RESOURCE_NOT_FOUND");

  const teamRole = await models.TeamRole.findOne({
    attributes: ["canExport", "projects", "role"],
    where: { team_id: project.team_id, user_id: userId },
  });
  if (!canExportChartImage(teamRole, normalizedProjectId)) {
    throw new ChartImageError("IMAGE_EXPORT_FORBIDDEN");
  }

  const chart = await models.Chart.findOne({
    attributes: ["id", "project_id"],
    where: { id: normalizedChartId, project_id: normalizedProjectId },
  });
  if (!chart) throw new ChartImageError("RESOURCE_NOT_FOUND");

  return {
    chartId: normalizedChartId,
    projectId: normalizedProjectId,
    teamId: Number(project.team_id),
    userId: Number(userId),
  };
}

module.exports = {
  PROJECT_ROLES,
  TEAM_ROLES,
  authorizeChartImage,
  canExportChartImage,
  parseResourceId,
};
