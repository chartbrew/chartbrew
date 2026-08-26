const { Op } = require("sequelize");

const TEAM_WIDE_ROLES = new Set(["teamOwner", "teamAdmin"]);
const PROJECT_ROLES = new Set(["projectAdmin", "projectEditor", "projectViewer"]);
const DATA_API_SCOPES = new Set(["data:read", "data:refresh"]);

function normalizeProjectIds(value) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function normalizeScopes(value) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter((scope) => DATA_API_SCOPES.has(scope)))];
}

function getEffectiveProjectIds({
  role,
  roleProjectIds = [],
  teamProjectIds = [],
  keyProjectIds = [],
  allProjects = false,
}) {
  let allowedByRole = [];
  if (TEAM_WIDE_ROLES.has(role)) {
    allowedByRole = normalizeProjectIds(teamProjectIds);
  } else if (PROJECT_ROLES.has(role)) {
    allowedByRole = normalizeProjectIds(roleProjectIds);
  }

  if (allProjects) return allowedByRole;

  const allowedByKey = new Set(normalizeProjectIds(keyProjectIds));
  return allowedByRole.filter((projectId) => allowedByKey.has(projectId));
}

async function buildDataApiAccess(db, apiKey, teamRole) {
  let teamProjectIds = [];
  if (TEAM_WIDE_ROLES.has(teamRole.role)) {
    const where = { team_id: apiKey.team_id };
    if (!apiKey.all_projects) {
      where.id = { [Op.in]: normalizeProjectIds(apiKey.project_ids) };
    }
    const teamProjects = await db.Project.findAll({ attributes: ["id"], where });
    teamProjectIds = teamProjects.map((project) => project.id);
  }

  return {
    apiKeyId: apiKey.id,
    teamId: apiKey.team_id,
    userId: apiKey.user_id,
    role: teamRole.role,
    allProjects: Boolean(apiKey.all_projects),
    projectIds: getEffectiveProjectIds({
      role: teamRole.role,
      roleProjectIds: teamRole.projects,
      teamProjectIds,
      keyProjectIds: apiKey.project_ids,
      allProjects: apiKey.all_projects,
    }),
    scopes: normalizeScopes(apiKey.scopes),
  };
}

async function findAccessibleChart(db, access, projectId, chartId) {
  if (!access.projectIds.includes(projectId)) return null;

  return db.Chart.findOne({
    attributes: ["id", "project_id"],
    where: {
      id: chartId,
      project_id: projectId,
    },
    include: [{
      model: db.Project,
      attributes: ["id", "team_id", "timezone"],
      where: {
        id: projectId,
        team_id: access.teamId,
      },
      required: true,
    }],
  });
}

async function findAccessibleDataset(db, access, teamId, datasetId) {
  if (teamId !== access.teamId) return null;

  const dataset = await db.Dataset.findOne({
    attributes: ["id", "name", "team_id", "project_ids", "fieldsSchema"],
    where: {
      id: datasetId,
      team_id: teamId,
    },
  });
  if (!dataset) return null;

  const datasetProjectIds = normalizeProjectIds(dataset.project_ids);
  if (datasetProjectIds.length === 0) {
    return TEAM_WIDE_ROLES.has(access.role) && access.allProjects ? dataset : null;
  }

  const effectiveProjects = new Set(access.projectIds);
  return datasetProjectIds.some((projectId) => effectiveProjects.has(projectId)) ? dataset : null;
}

async function validateKeyProjectIds(db, teamId, projectIds) {
  if (!Array.isArray(projectIds) || projectIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return false;
  }

  const normalizedIds = normalizeProjectIds(projectIds);
  if (normalizedIds.length !== projectIds.length) return false;

  const count = await db.Project.count({
    where: {
      id: { [Op.in]: normalizedIds },
      team_id: teamId,
    },
  });

  return count === normalizedIds.length;
}

module.exports = {
  DATA_API_SCOPES,
  PROJECT_ROLES,
  TEAM_WIDE_ROLES,
  buildDataApiAccess,
  findAccessibleChart,
  findAccessibleDataset,
  getEffectiveProjectIds,
  normalizeProjectIds,
  normalizeScopes,
  validateKeyProjectIds,
};
