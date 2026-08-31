const { Op } = require("sequelize");

const db = require("../../models/models");

const TEAM_ADMIN_ROLES = new Set(["teamAdmin", "teamOwner"]);
const PROJECT_EDITOR_ROLES = new Set(["projectAdmin", "projectEditor"]);

function createHttpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeProjectIds(projects) {
  return Array.isArray(projects)
    ? projects.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : [];
}

async function getObservationAccess(teamId, userId) {
  const teamRole = await db.TeamRole.findOne({
    include: [{
      model: db.Team,
      attributes: ["aiEnabled"],
    }],
    where: {
      team_id: teamId,
      user_id: userId,
    },
  });
  if (!teamRole) throw createHttpError("Access denied", 403);

  return {
    allProjects: TEAM_ADMIN_ROLES.has(teamRole.role),
    canConfigureTeam: TEAM_ADMIN_ROLES.has(teamRole.role),
    teamAiEnabled: teamRole.Team?.aiEnabled !== false,
    projectIds: normalizeProjectIds(teamRole.projects),
    role: teamRole.role,
    teamId: Number(teamId),
    userId: Number(userId),
  };
}

function getProjectScope(access, field = "project_id") {
  if (access.allProjects) return {};
  return {
    [field]: {
      [Op.in]: access.projectIds.length > 0 ? access.projectIds : [-1],
    },
  };
}

function canEditProject(access, projectId) {
  if (access.allProjects) return true;
  return PROJECT_EDITOR_ROLES.has(access.role)
    && access.projectIds.includes(Number(projectId));
}

function assertCanEditProject(access, projectId) {
  if (!canEditProject(access, projectId)) {
    throw createHttpError("You do not have permission to change this metric", 403);
  }
}

function assertCanViewProject(access, projectId) {
  if (!access.allProjects && !access.projectIds.includes(Number(projectId))) {
    throw createHttpError("Access denied", 403);
  }
}

module.exports = {
  PROJECT_EDITOR_ROLES,
  TEAM_ADMIN_ROLES,
  assertCanEditProject,
  assertCanViewProject,
  canEditProject,
  createHttpError,
  getObservationAccess,
  getProjectScope,
  normalizeProjectIds,
};
