const { Op } = require("sequelize");

const db = require("../../models/models");
const DigestController = require("../../controllers/DigestController");
const MonitorController = require("../../controllers/MonitorController");
const { getProjectScope } = require("../observations/access");
const { createActionAudit } = require("./actionAudit");
const { getWorkspaceAccessEnvelope } = require("./accessEnvelope");
const {
  getKpiReviewAuditValues,
  getMonitorAuditValues,
} = require("./auditValues");
const {
  consumePendingAction,
  hashSessionBinding,
} = require("./previewStore");
const { getWorkspaceOrchestratorPolicy } = require("./policy");

function createActionError(message, statusCode, code) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function getResourceVersion(resource) {
  return resource?.updatedAt?.toISOString?.() || null;
}

function assertCurrentVersion(resource, expectedVersion) {
  if (!expectedVersion || getResourceVersion(resource) === expectedVersion) return;
  throw createActionError(
    "This item changed after the preview. Prepare the change again.",
    409,
    "PENDING_ACTION_RESOURCE_CHANGED"
  );
}

function assertProjectScope(expectedProjectId, actualProjectId) {
  if (expectedProjectId === null || expectedProjectId === undefined) return;
  if (`${expectedProjectId}` === `${actualProjectId}`) return;
  throw createActionError(
    "This item is no longer in the previewed dashboard.",
    409,
    "PENDING_ACTION_SCOPE_CHANGED"
  );
}

function buildAppliedResult(audit) {
  const after = audit.after_values || {};
  return {
    actionId: audit.action_id,
    actionType: audit.action_type,
    applied: after,
    resource: {
      id: audit.resource_id,
      name: after.name || (audit.resource_type === "kpi_review" ? "KPI review" : "Watched metric"),
      projectId: audit.project_id,
    },
    status: "applied",
  };
}

async function findAppliedResult(access, actionId, sessionId) {
  const projectScope = access.allProjects ? {} : {
    [Op.or]: [{ project_id: null }, {
      project_id: {
        [Op.in]: access.projectIds.length > 0 ? access.projectIds : [-1],
      },
    }],
  };
  const audit = await db.OrchestratorActionAudit.findOne({
    where: {
      action_id: actionId,
      actor_user_id: access.userId,
      session_binding_hash: hashSessionBinding(sessionId),
      status: "applied",
      team_id: access.teamId,
      ...projectScope,
    },
  });
  return audit ? buildAppliedResult(audit) : null;
}

async function findRecentDirectResult(access, pendingAction, sessionId) {
  const policy = getWorkspaceOrchestratorPolicy();
  const projectScope = access.allProjects ? {} : {
    [Op.or]: [{ project_id: null }, {
      project_id: {
        [Op.in]: access.projectIds.length > 0 ? access.projectIds : [-1],
      },
    }],
  };
  const retryCutoff = new Date(Date.now() - (policy.previewTtlSeconds * 1000));
  const audit = await db.OrchestratorActionAudit.findOne({
    order: [["createdAt", "DESC"]],
    where: {
      action_type: pendingAction.actionType,
      actor_user_id: access.userId,
      authority_type: "clear_instruction",
      createdAt: { [Op.gte]: retryCutoff },
      proposal_hash: pendingAction.proposalHash,
      session_binding_hash: hashSessionBinding(sessionId),
      status: "applied",
      team_id: access.teamId,
      ...projectScope,
    },
  });
  return audit ? buildAppliedResult(audit) : null;
}

function assertWriteEnabled(actionType) {
  const policy = getWorkspaceOrchestratorPolicy();
  if (!policy.enabled) {
    throw createActionError("Workspace actions are not enabled", 403, "ACTION_POLICY_DISABLED");
  }
  if (actionType.startsWith("metric_monitor.") && !policy.metricMonitorWritesEnabled) {
    throw createActionError(
      "Watched metric actions are not enabled for this workspace",
      403,
      "MONITOR_WRITES_DISABLED"
    );
  }
  if (actionType.startsWith("kpi_review.") && !policy.kpiReviewWritesEnabled) {
    throw createActionError(
      "KPI review actions are not enabled for this workspace",
      403,
      "KPI_REVIEW_WRITES_DISABLED"
    );
  }
}

function assertRoleWriteEnabled(envelope, actionType) {
  if (actionType.startsWith("metric_monitor.") && !envelope.metricMonitorWritesEnabled) {
    throw createActionError(
      "You do not have permission to change watched metrics",
      403,
      "MONITOR_WRITE_FORBIDDEN"
    );
  }
  if (actionType.startsWith("kpi_review.") && !envelope.kpiReviewWritesEnabled) {
    throw createActionError(
      "You do not have permission to change KPI review schedules",
      403,
      "KPI_REVIEW_WRITE_FORBIDDEN"
    );
  }
}

async function applyMonitorAction(access, pendingAction, transaction, authorityType) {
  const controller = new MonitorController();
  const { actionType, proposal, resourceVersion, scope } = pendingAction;
  let beforeValues = {};
  let resource;

  if (actionType === "metric_monitor.create") {
    resource = await controller.createStrict(access, proposal.data, { transaction });
  } else if (actionType === "metric_monitor.update") {
    const monitor = await controller.findById(access, scope.resourceId, { transaction });
    assertCurrentVersion(monitor, resourceVersion);
    assertProjectScope(scope.projectId, monitor.project_id);
    beforeValues = getMonitorAuditValues(monitor);
    resource = await controller.update(access, monitor.id, proposal.data, { transaction });
  } else {
    throw createActionError("This watched metric action is not supported", 400, "ACTION_INVALID");
  }

  assertProjectScope(scope.projectId, resource.projectId);
  const afterValues = getMonitorAuditValues(resource);
  await createActionAudit({
    access,
    actionId: pendingAction.actionId,
    actionType,
    afterValues,
    authorityType,
    beforeValues,
    projectId: resource.projectId,
    proposalHash: pendingAction.proposalHash,
    resourceId: resource.id,
    resourceType: "metric_monitor",
    sessionBindingHash: pendingAction.sessionBindingHash,
    status: "applied",
    transaction,
  });
  return {
    actionId: pendingAction.actionId,
    actionType,
    applied: afterValues,
    resource: {
      id: resource.id,
      name: resource.name,
      projectId: resource.projectId,
    },
    status: "applied",
  };
}

async function applyKpiReviewAction(access, pendingAction, transaction, authorityType) {
  const controller = new DigestController();
  const { actionType, proposal, resourceVersion, scope } = pendingAction;
  let beforeValues = {};
  let resource;

  if (actionType === "kpi_review.create") {
    resource = await controller.createStrict(access, proposal.data, { transaction });
  } else if (actionType === "kpi_review.update") {
    const review = await controller.find(access, scope.resourceId, { transaction });
    assertCurrentVersion(review, resourceVersion);
    beforeValues = getKpiReviewAuditValues(review);
    resource = await controller.update(access, review.id, proposal.data, { transaction });
  } else {
    throw createActionError("This KPI review action is not supported", 400, "ACTION_INVALID");
  }

  let resourceProjectId = resource.projectId || resource.scope?.projectId || null;
  if (!resourceProjectId && resource.monitorId) {
    const monitor = await db.MetricMonitor.findOne({
      attributes: ["project_id"],
      transaction,
      where: {
        id: resource.monitorId,
        team_id: access.teamId,
        ...getProjectScope(access),
      },
    });
    resourceProjectId = monitor?.project_id || null;
  }
  assertProjectScope(scope.projectId, resourceProjectId);
  const afterValues = getKpiReviewAuditValues(resource);
  await createActionAudit({
    access,
    actionId: pendingAction.actionId,
    actionType,
    afterValues,
    authorityType,
    beforeValues,
    projectId: resourceProjectId,
    proposalHash: pendingAction.proposalHash,
    resourceId: resource.id,
    resourceType: "kpi_review",
    sessionBindingHash: pendingAction.sessionBindingHash,
    status: "applied",
    transaction,
  });
  return {
    actionId: pendingAction.actionId,
    actionType,
    applied: afterValues,
    resource: {
      id: resource.id,
      name: resource.scope?.name || "KPI review",
      projectId: resourceProjectId,
    },
    status: "applied",
  };
}

async function recordFailure(access, pendingAction, error, authorityType) {
  if (!pendingAction) return;
  let status = "failed";
  if (error.statusCode === 403) status = "rejected";
  if (error.statusCode === 409) status = "conflicted";
  try {
    await createActionAudit({
      access,
      actionId: pendingAction.actionId,
      actionType: pendingAction.actionType,
      afterValues: pendingAction.proposal?.changedValues || {},
      authorityType,
      failureCode: error.code || (error.statusCode === 409 ? "ACTION_CONFLICT" : "ACTION_FAILED"),
      projectId: pendingAction.scope?.projectId || null,
      proposalHash: pendingAction.proposalHash,
      resourceId: pendingAction.scope?.resourceId || null,
      resourceType: pendingAction.actionType.startsWith("kpi_review.")
        ? "kpi_review"
        : "metric_monitor",
      sessionBindingHash: pendingAction.sessionBindingHash,
      status,
    });
  } catch (auditError) {
    if (auditError.name !== "SequelizeUniqueConstraintError") throw auditError;
  }
}

async function executePendingAction({
  access,
  actionId,
  authorityType = "confirmed_preview",
  sessionId,
}) {
  if (!["clear_instruction", "confirmed_preview"].includes(authorityType)) {
    throw createActionError("This action authority is not valid", 400, "ACTION_AUTHORITY_INVALID");
  }
  const appliedResult = await findAppliedResult(access, actionId, sessionId);
  if (appliedResult) return appliedResult;
  const envelope = await getWorkspaceAccessEnvelope(access);
  let pendingAction;
  try {
    const consumed = await consumePendingAction({
      access,
      accessVersion: envelope.accessVersion,
      actionId,
      sessionId,
    });
    pendingAction = consumed.pendingAction;
    if (authorityType === "clear_instruction"
      && !pendingAction.actionType.startsWith("metric_monitor.")) {
      throw createActionError(
        "This change needs confirmation",
        409,
        "ACTION_CONFIRMATION_REQUIRED"
      );
    }
    if (authorityType === "clear_instruction") {
      const recentResult = await findRecentDirectResult(access, pendingAction, sessionId);
      if (recentResult) return recentResult;
    }
    assertRoleWriteEnabled(envelope, pendingAction.actionType);
    assertWriteEnabled(pendingAction.actionType);
    const result = await db.sequelize.transaction(async (transaction) => {
      if (pendingAction.actionType.startsWith("metric_monitor.")) {
        return applyMonitorAction(access, pendingAction, transaction, authorityType);
      }
      if (pendingAction.actionType.startsWith("kpi_review.")) {
        return applyKpiReviewAction(access, pendingAction, transaction, authorityType);
      }
      throw createActionError("This prepared action is not supported", 400, "ACTION_INVALID");
    });
    return result;
  } catch (error) {
    pendingAction = pendingAction || error.pendingActionForAudit;
    await recordFailure(access, pendingAction, error, authorityType);
    throw error;
  }
}

module.exports = {
  assertCurrentVersion,
  assertRoleWriteEnabled,
  executePendingAction,
  findAppliedResult,
  findRecentDirectResult,
  getKpiReviewValues: getKpiReviewAuditValues,
  getMonitorValues: getMonitorAuditValues,
};
