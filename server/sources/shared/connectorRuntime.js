const _ = require("lodash");

const drCacheController = require("../../controllers/DataRequestCacheController");
const {
  completeRun,
  failRun,
  finishEvent,
} = require("../../modules/updateAudit");

const SENSITIVE_AUDIT_FIELDS = new Set([
  "bodySnippet",
  "filters",
  "headerNames",
  "queryHash",
  "queryPreview",
  "responseSnippet",
  "routeHash",
  "routeSnippet",
  "variables",
]);

function buildConnectorAuditPayload(auditContext, payload = {}) {
  const mergedPayload = {
    ...(auditContext?.requestMetadata || {}),
    ...payload,
  };
  if (!auditContext?.redactSensitivePayload) return mergedPayload;

  return Object.entries(mergedPayload).reduce((safePayload, [key, value]) => {
    if (!SENSITIVE_AUDIT_FIELDS.has(key)) safePayload[key] = value;
    return safePayload;
  }, {});
}

function getConnectorAuditError(auditContext, error, stage) {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  wrappedError.auditStage = wrappedError.auditStage || stage;
  if (!auditContext?.redactSensitivePayload) return wrappedError;

  const safeError = new Error("The data source request failed.");
  safeError.code = "DATA_UNAVAILABLE";
  safeError.auditStage = wrappedError.auditStage;
  return safeError;
}

async function checkAndGetCache(connectionId, dataRequest) {
  try {
    const drCache = await drCacheController.findLast(dataRequest.id);
    const cachedDataRequest = { ...drCache.dataRequest };
    cachedDataRequest.updatedAt = "";
    cachedDataRequest.createdAt = "";
    delete cachedDataRequest.Connection;

    const liveDataRequest = dataRequest.toJSON ? dataRequest.toJSON() : { ...dataRequest };
    liveDataRequest.updatedAt = "";
    liveDataRequest.createdAt = "";
    delete liveDataRequest.Connection;

    if (_.isEqual(cachedDataRequest, liveDataRequest) && drCache.connection_id === connectionId) {
      return {
        responseData: drCache.responseData,
        dataRequest: drCache.dataRequest,
      };
    }
  } catch (e) {
    return false;
  }

  return false;
}

async function completeConnectorAudit(auditContext, payload = {}, summary = null) {
  if (!auditContext?.traceContext) {
    return;
  }

  const finalPayload = buildConnectorAuditPayload(auditContext, payload);
  const finalSummary = summary
    ? buildConnectorAuditPayload(auditContext, summary)
    : finalPayload;

  if (auditContext.requestEvent) {
    await finishEvent(auditContext.traceContext, auditContext.requestEvent, "success", finalPayload);
  }

  await completeRun(auditContext.traceContext, {
    status: "success",
    payload: finalPayload,
    summary: finalSummary,
  });
}

async function failConnectorAudit(auditContext, error, stage = "connection", payload = {}) {
  if (!auditContext?.traceContext) {
    return;
  }

  const wrappedError = error instanceof Error ? error : new Error(String(error));
  wrappedError.auditStage = wrappedError.auditStage || stage;
  const auditError = getConnectorAuditError(auditContext, wrappedError, stage);
  const finalPayload = buildConnectorAuditPayload(auditContext, payload);

  if (auditContext.requestEvent) {
    await finishEvent(auditContext.traceContext, auditContext.requestEvent, "failed", {
      ...finalPayload,
      errorMessage: auditError.message,
    });
  }

  await failRun(auditContext.traceContext, auditError, {
    stage: auditError.auditStage || stage,
    payload: finalPayload,
    summary: finalPayload,
  });

  wrappedError.auditLogged = true;
}

module.exports = {
  buildConnectorAuditPayload,
  checkAndGetCache,
  completeConnectorAudit,
  failConnectorAudit,
  getConnectorAuditError,
};
