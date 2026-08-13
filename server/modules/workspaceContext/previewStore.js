const crypto = require("crypto");

const runtimeCache = require("../runtimeCache");
const { getWorkspaceOrchestratorPolicy } = require("./policy");

const ALLOWED_ACTION_TYPES = new Set([
  "kpi_review.create",
  "kpi_review.update",
  "metric_monitor.create",
  "metric_monitor.update",
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

function hashProposal(proposal) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(proposal)))
    .digest("hex");
}

function hashSessionBinding(sessionId) {
  return crypto
    .createHash("sha256")
    .update(`${sessionId || ""}`)
    .digest("hex");
}

function getActionCacheParams({ access, actionId, sessionId }) {
  if (!sessionId) {
    const error = new Error("Start this action from an active Chartbrew conversation");
    error.statusCode = 400;
    throw error;
  }
  return {
    actionId,
    sessionId,
    teamId: access.teamId,
    userId: access.userId,
  };
}

function attachPendingActionForAudit(error, pendingAction) {
  Object.defineProperty(error, "pendingActionForAudit", {
    configurable: false,
    enumerable: false,
    value: pendingAction,
    writable: false,
  });
  return error;
}

async function createPendingAction({
  access,
  actionType,
  accessVersion,
  projectId = null,
  proposal,
  resourceId = null,
  resourceVersion = null,
  sessionId,
  sourceMessageId = null,
}) {
  if (!ALLOWED_ACTION_TYPES.has(actionType)) {
    const error = new Error("This action cannot be prepared");
    error.statusCode = 400;
    throw error;
  }
  const actionId = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + (getWorkspaceOrchestratorPolicy().previewTtlSeconds * 1000)
  );
  const pendingAction = {
    accessVersion,
    actionId,
    actionType,
    actor: { teamId: access.teamId, userId: access.userId },
    expiresAt: expiresAt.toISOString(),
    proposal: canonicalize(proposal),
    proposalHash: hashProposal(proposal),
    resourceVersion,
    schemaVersion: 1,
    sessionBindingHash: hashSessionBinding(sessionId),
    scope: { projectId, resourceId },
    sourceMessageId,
  };
  await runtimeCache.setPendingAiAction({
    ...getActionCacheParams({ access, actionId, sessionId }),
    payload: pendingAction,
  });
  return {
    actionId,
    expiresAt: expiresAt.toISOString(),
  };
}

async function consumePendingAction({ access, actionId, accessVersion, sessionId }) {
  const cacheParams = getActionCacheParams({ access, actionId, sessionId });
  const pendingAction = await runtimeCache.consumePendingAiAction(cacheParams);
  if (!pendingAction || new Date(pendingAction.expiresAt) <= new Date()) {
    const error = new Error("This confirmation has expired. Prepare the change again.");
    error.code = "PENDING_ACTION_EXPIRED";
    error.statusCode = 409;
    throw error;
  }
  if (pendingAction.accessVersion !== accessVersion) {
    const error = new Error("Your access changed. Prepare the change again.");
    error.code = "PENDING_ACTION_ACCESS_CHANGED";
    error.statusCode = 409;
    throw attachPendingActionForAudit(error, pendingAction);
  }
  if (pendingAction.sessionBindingHash !== hashSessionBinding(sessionId)) {
    const error = new Error("This confirmation belongs to another chat. Prepare the change again.");
    error.code = "PENDING_ACTION_SESSION_CHANGED";
    error.statusCode = 409;
    throw attachPendingActionForAudit(error, pendingAction);
  }
  if (hashProposal(pendingAction.proposal) !== pendingAction.proposalHash) {
    const error = new Error("This confirmation is no longer valid. Prepare the change again.");
    error.code = "PENDING_ACTION_INVALID";
    error.statusCode = 409;
    throw attachPendingActionForAudit(error, pendingAction);
  }
  return { pendingAction };
}

async function clearPendingActions({ access, projectId, resourceId, sessionId }) {
  return runtimeCache.clearPendingAiActions({
    ...(projectId ? { projectId } : {}),
    ...(resourceId ? { resourceId } : {}),
    ...(sessionId ? { sessionId } : {}),
    teamId: access.teamId,
    userId: access.userId,
  });
}

async function listPendingActions({ access, sessionId }) {
  if (!sessionId) return [];
  return runtimeCache.listPendingAiActions({
    sessionId,
    teamId: access.teamId,
    userId: access.userId,
  });
}

module.exports = {
  ALLOWED_ACTION_TYPES,
  canonicalize,
  clearPendingActions,
  consumePendingAction,
  createPendingAction,
  hashProposal,
  hashSessionBinding,
  listPendingActions,
};
