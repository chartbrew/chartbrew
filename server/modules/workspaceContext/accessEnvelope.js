const { editorRoles, viewerRoles } = require("../../../shared/roles.json");
const crypto = require("crypto");

const db = require("../../models/models");
const { getWorkspaceOrchestratorPolicy } = require("./policy");

function getOpenAiKey() {
  return process.env.NODE_ENV === "production"
    ? process.env.CB_OPENAI_API_KEY
    : process.env.CB_OPENAI_API_KEY_DEV;
}

function buildAccessVersion(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

async function getWorkspaceAccessEnvelope(access) {
  const projects = await db.Project.findAll({
    attributes: ["id"],
    order: [["id", "ASC"]],
    where: {
      ghost: false,
      team_id: access.teamId,
    },
  });
  const teamProjectIds = projects.map((project) => Number(project.id));
  const visibleProjectIds = access.allProjects
    ? teamProjectIds
    : teamProjectIds.filter((projectId) => access.projectIds.includes(projectId));
  let editableProjectIds = [];
  if (editorRoles.includes(access.role)) {
    editableProjectIds = visibleProjectIds;
  }
  const user = await db.User.findByPk(access.userId, {
    attributes: ["email"],
  });
  const reportingOnly = viewerRoles.includes(access.role);
  const orchestratorPolicy = getWorkspaceOrchestratorPolicy();
  const workspaceOrchestratorEnabled = orchestratorPolicy.enabled
    && access.teamAiEnabled !== false;
  const policy = {
    externalAiEnabled: Boolean(getOpenAiKey()),
    kpiReviewWritesEnabled: orchestratorPolicy.kpiReviewWritesEnabled,
    learningRetrievalEnabled: orchestratorPolicy.learningRetrievalEnabled,
    metricMonitorWritesEnabled: orchestratorPolicy.metricMonitorWritesEnabled,
    workspaceOrchestratorEnabled,
  };
  const accessVersion = buildAccessVersion({
    editableProjectIds,
    policy,
    role: access.role,
    teamId: access.teamId,
    userId: access.userId,
    visibleProjectIds,
  });

  return {
    accessVersion,
    canConfigureConnections: access.canConfigureTeam,
    canCreatePersonalKpiReview: !reportingOnly && Boolean(user?.email),
    canUseExternalAi: policy.externalAiEnabled,
    canUseExternalWorkspaceContext: policy.externalAiEnabled
      && policy.workspaceOrchestratorEnabled,
    canViewOwnerAudit: access.canConfigureTeam,
    editableProjectIds,
    hasDeliveryEmail: Boolean(user?.email),
    kpiReviewWritesEnabled: !reportingOnly && policy.kpiReviewWritesEnabled,
    learningRetrievalEnabled: policy.learningRetrievalEnabled,
    metricMonitorWritesEnabled: !reportingOnly && policy.metricMonitorWritesEnabled,
    role: access.role,
    teamId: access.teamId,
    userId: access.userId,
    visibleProjectIds,
    workspaceOrchestratorEnabled: policy.workspaceOrchestratorEnabled,
    workspaceWritesEnabled: !reportingOnly
      && (policy.metricMonitorWritesEnabled || policy.kpiReviewWritesEnabled),
  };
}

module.exports = {
  buildAccessVersion,
  getWorkspaceAccessEnvelope,
};
