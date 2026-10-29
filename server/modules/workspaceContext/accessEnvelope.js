const { editorRoles, viewerRoles } = require("../../../shared/roles.json");
const crypto = require("crypto");
const { isDeepStrictEqual } = require("node:util");

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

function canReadHistoryMessage(message, envelope) {
  if (!message.sensitive_workspace_context) return true;
  if (!envelope?.accessVersion) return false;
  if (message.workspace_access_version === envelope.accessVersion) return true;

  const previous = message.workspace_access_scope;
  const current = envelope.historyAccessScope;
  if (!previous || !current) return false;

  const { visibleProjectIds, editableProjectIds, ...previousPermissions } = previous;
  const {
    visibleProjectIds: currentVisible,
    editableProjectIds: currentEditable,
    ...currentPermissions
  } = current;
  if (!Array.isArray(visibleProjectIds) || !Array.isArray(editableProjectIds)) return false;
  if (!isDeepStrictEqual(previousPermissions, currentPermissions)) return false;

  return visibleProjectIds.every((id) => currentVisible.includes(id))
    && editableProjectIds.every((id) => currentEditable.includes(id));
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
  const historyAccessScope = {
    editableProjectIds,
    policy,
    role: access.role,
    teamId: access.teamId,
    userId: access.userId,
    visibleProjectIds,
  };
  const accessVersion = buildAccessVersion(historyAccessScope);

  return {
    accessVersion,
    historyAccessScope,
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
  canReadHistoryMessage,
  getWorkspaceAccessEnvelope,
};
