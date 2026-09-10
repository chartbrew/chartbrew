const crypto = require("crypto");
const { Op } = require("sequelize");

const db = require("../models/models");
const { getDataRecovery } = require("./dataRecovery");
const {
  isOutboundPolicyError,
  serializeOutboundPolicyError,
} = require("./outboundTargetPolicy");

const SENSITIVE_KEY_PATTERN = /(authorization|password|token|secret|apikey|api_key|cookie|set-cookie|connectionstring|ssh|privatekey|passphrase|username)/i;
const DEFAULT_MAX_STRING_LENGTH = 512;
const DEFAULT_ARRAY_PREVIEW = 10;
const ERROR_MESSAGE_LENGTH = 1000;

function createTraceId() {
  return crypto.randomBytes(16).toString("hex");
}

function createHash(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

function hydrateDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function truncateString(value, maxLength = DEFAULT_MAX_STRING_LENGTH) {
  if (value === undefined || value === null) {
    return value;
  }

  const stringValue = String(value);
  if (stringValue.length <= maxLength) {
    return stringValue;
  }

  return `${stringValue.slice(0, maxLength)}...[truncated]`;
}

function collapseWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function redactScalar(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/Basic\s+[A-Za-z0-9\-._~+/]+=*/gi, "Basic [REDACTED]")
    .replace(/(token|password|secret|apikey|api_key)=([^&\s]+)/gi, "$1=[REDACTED]");
}

function sanitizePayload(value, depth = 0) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(redactScalar(value));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= 5) {
    return "[MaxDepth]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, DEFAULT_ARRAY_PREVIEW)
      .map((item) => sanitizePayload(item, depth + 1));
  }

  const sanitized = {};
  Object.keys(value).forEach((key) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED]";
      return;
    }

    sanitized[key] = sanitizePayload(value[key], depth + 1);
  });

  return sanitized;
}

function sanitizeSnippet(value, maxLength = DEFAULT_MAX_STRING_LENGTH) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string") {
    return truncateString(redactScalar(collapseWhitespace(value)), maxLength);
  }

  try {
    return truncateString(JSON.stringify(sanitizePayload(value)), maxLength);
  } catch (error) {
    return truncateString(String(value), maxLength);
  }
}

function sanitizeHeaderNames(headers) {
  if (!headers || typeof headers !== "object") {
    return [];
  }

  return Object.keys(headers).map((key) => key.toLowerCase());
}

function sanitizeRouteSnippet(route) {
  if (!route) {
    return null;
  }

  try {
    const url = new URL(route, "https://chartbrew.audit");
    const queryKeys = [];
    url.searchParams.forEach((_value, key) => {
      queryKeys.push(key);
    });

    return truncateString(
      `${url.pathname}${queryKeys.length > 0 ? `?${queryKeys.map((key) => `${key}=`).join("&")}` : ""}`,
      240
    );
  } catch (error) {
    const [pathOnly, queryString] = String(route).split("?");
    if (!queryString) {
      return truncateString(pathOnly, 240);
    }

    const queryKeys = queryString
      .split("&")
      .map((part) => part.split("=")[0])
      .filter(Boolean);

    return truncateString(
      `${pathOnly}?${queryKeys.map((key) => `${key}=`).join("&")}`,
      240
    );
  }
}

function sanitizeQueryPreview(query) {
  if (!query) {
    return null;
  }

  return truncateString(
    collapseWhitespace(String(query))
      .replace(/'[^']*'/g, "'?'")
      .replace(/"[^"]*"/g, "\"?\"")
      .replace(/\b\d+\b/g, "#"),
    240
  );
}

function getItemCount(value) {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length;
  }

  return value === undefined || value === null ? 0 : 1;
}

function serializeResponsePreview(responseData) {
  if (!responseData) {
    return {
      itemCount: 0,
      responseSnippet: null,
    };
  }

  const data = responseData.data !== undefined ? responseData.data : responseData;

  return {
    itemCount: getItemCount(data),
    responseSnippet: sanitizeSnippet(data),
  };
}

function normalizeError(error, fallbackStage = "unknown") {
  if (!error) {
    return {
      errorStage: fallbackStage,
      errorClass: "Error",
      errorCode: null,
      errorMessage: "Unknown error",
    };
  }

  if (isOutboundPolicyError(error)) {
    const serializedPolicyError = serializeOutboundPolicyError(error);
    return {
      errorStage: "policy",
      errorClass: error.name || "OutboundPolicyError",
      errorCode: error.code || serializedPolicyError?.code || null,
      errorMessage: truncateString(
        serializedPolicyError?.message || error.message || String(error),
        ERROR_MESSAGE_LENGTH
      ),
    };
  }

  const stage = error.auditStage || fallbackStage;
  const errorCode = error.code
    || (error.original && error.original.code)
    || error.statusCode
    || null;

  return {
    errorStage: stage,
    errorClass: error.name || typeof error,
    errorCode: errorCode ? String(errorCode) : null,
    errorMessage: truncateString(error.message || String(error), ERROR_MESSAGE_LENGTH),
  };
}

function getDurationMs(startedAt, finishedAt) {
  const normalizedStartedAt = hydrateDate(startedAt);
  const normalizedFinishedAt = hydrateDate(finishedAt);

  if (!normalizedStartedAt || !normalizedFinishedAt) {
    return null;
  }

  return Math.max(0, normalizedFinishedAt.getTime() - normalizedStartedAt.getTime());
}

function emitStructuredAuditLog(action, payload) {
  return { action, payload };
}

function emitAuditInternalError(message, error) {
  return { message, error };
}

function cloneTraceContext(traceContext = {}) {
  const sourceTraceContext = traceContext || {};

  return {
    runId: sourceTraceContext.runId || null,
    traceId: sourceTraceContext.traceId || null,
    rootTraceId: sourceTraceContext.rootTraceId || null,
    parentRunId: sourceTraceContext.parentRunId || null,
    triggerType: sourceTraceContext.triggerType || null,
    entityType: sourceTraceContext.entityType || null,
    teamId: sourceTraceContext.teamId || null,
    projectId: sourceTraceContext.projectId || null,
    chartId: sourceTraceContext.chartId || null,
    datasetId: sourceTraceContext.datasetId || null,
    dataRequestId: sourceTraceContext.dataRequestId || null,
    connectionId: sourceTraceContext.connectionId || null,
    apiKeyId: sourceTraceContext.apiKeyId || null,
    queueName: sourceTraceContext.queueName || null,
    jobId: sourceTraceContext.jobId || null,
    startedAt: hydrateDate(sourceTraceContext.startedAt),
    nextSequence: sourceTraceContext.nextSequence || 1,
  };
}

async function persistRun(context, values) {
  if (!db.UpdateRun || !context.runId) {
    emitStructuredAuditLog("run_update_skipped", {
      traceId: context.traceId,
      rootTraceId: context.rootTraceId,
      values,
    });
    return context;
  }

  try {
    await db.UpdateRun.update(values, { where: { id: context.runId } });
  } catch (error) {
    emitAuditInternalError("[updateAudit] failed to update run", error);
  }

  emitStructuredAuditLog("run_updated", {
    runId: context.runId,
    traceId: context.traceId,
    rootTraceId: context.rootTraceId,
    values,
  });

  return context;
}

async function startRun(payload = {}, parentTraceContext = null) {
  const baseContext = cloneTraceContext(parentTraceContext);
  const traceId = payload.traceId || createTraceId();
  const rootTraceId = payload.rootTraceId || baseContext.rootTraceId || traceId;
  const startedAt = payload.startedAt || new Date();

  const context = {
    ...baseContext,
    traceId,
    rootTraceId,
    parentRunId: payload.parentRunId !== undefined ? payload.parentRunId : baseContext.runId,
    triggerType: payload.triggerType || baseContext.triggerType || "unknown",
    entityType: payload.entityType || baseContext.entityType || "unknown",
    teamId: payload.teamId !== undefined ? payload.teamId : baseContext.teamId,
    projectId: payload.projectId !== undefined ? payload.projectId : baseContext.projectId,
    chartId: payload.chartId !== undefined ? payload.chartId : baseContext.chartId,
    datasetId: payload.datasetId !== undefined ? payload.datasetId : baseContext.datasetId,
    dataRequestId: payload.dataRequestId !== undefined
      ? payload.dataRequestId
      : baseContext.dataRequestId,
    connectionId: payload.connectionId !== undefined
      ? payload.connectionId
      : baseContext.connectionId,
    apiKeyId: payload.apiKeyId !== undefined ? payload.apiKeyId : baseContext.apiKeyId,
    queueName: payload.queueName !== undefined ? payload.queueName : baseContext.queueName,
    jobId: payload.jobId !== undefined ? payload.jobId : baseContext.jobId,
    nextSequence: 1,
    startedAt,
  };

  const createValues = {
    traceId: context.traceId,
    rootTraceId: context.rootTraceId,
    parentRunId: context.parentRunId,
    triggerType: context.triggerType,
    entityType: context.entityType,
    teamId: context.teamId,
    projectId: context.projectId,
    chartId: context.chartId,
    datasetId: context.datasetId,
    dataRequestId: context.dataRequestId,
    connectionId: context.connectionId,
    apiKeyId: context.apiKeyId,
    queueName: context.queueName,
    jobId: context.jobId,
    status: payload.status || "running",
    startedAt,
    summary: sanitizePayload(payload.summary),
  };

  try {
    if (db.UpdateRun) {
      const run = await db.UpdateRun.create(createValues);
      context.runId = run.id;
    }
  } catch (error) {
    emitAuditInternalError("[updateAudit] failed to create run", error);
  }

  emitStructuredAuditLog("run_started", {
    runId: context.runId,
    traceId: context.traceId,
    rootTraceId: context.rootTraceId,
    parentRunId: context.parentRunId,
    triggerType: context.triggerType,
    entityType: context.entityType,
    status: createValues.status,
    teamId: context.teamId,
    projectId: context.projectId,
    chartId: context.chartId,
    datasetId: context.datasetId,
    dataRequestId: context.dataRequestId,
    connectionId: context.connectionId,
    apiKeyId: context.apiKeyId,
    queueName: context.queueName,
    jobId: context.jobId,
    summary: createValues.summary,
  });

  return context;
}

async function updateRunContext(traceContext, values = {}) {
  if (!traceContext) {
    return null;
  }

  const context = cloneTraceContext(traceContext);
  Object.assign(context, values);

  const persistedValues = { ...values };
  if (persistedValues.summary !== undefined) {
    persistedValues.summary = sanitizePayload(persistedValues.summary);
  }

  await persistRun(context, persistedValues);
  return context;
}

async function startEvent(traceContext, stage, payload = {}, status = "started") {
  if (!traceContext) {
    return null;
  }

  const eventPayload = sanitizePayload(payload);
  const startedAt = new Date();
  const event = {
    runId: traceContext.runId || null,
    sequence: traceContext.nextSequence || 1,
    stage,
    status,
    startedAt,
    payload: eventPayload,
  };

  const mutableTraceContext = traceContext;
  mutableTraceContext.nextSequence = event.sequence + 1;

  try {
    if (db.UpdateRunEvent && traceContext.runId) {
      const createdEvent = await db.UpdateRunEvent.create({
        runId: traceContext.runId,
        sequence: event.sequence,
        stage,
        status,
        startedAt,
        payload: eventPayload,
      });
      event.id = createdEvent.id;
    }
  } catch (error) {
    emitAuditInternalError("[updateAudit] failed to create event", error);
  }

  emitStructuredAuditLog("event_started", {
    runId: traceContext.runId,
    traceId: traceContext.traceId,
    rootTraceId: traceContext.rootTraceId,
    sequence: event.sequence,
    stage,
    status,
    payload: eventPayload,
  });

  return event;
}

async function finishEvent(traceContext, event, status = "success", payload = {}) {
  if (!traceContext || !event) {
    return null;
  }

  const finishedAt = new Date();
  const mergedPayload = sanitizePayload({
    ...(event.payload || {}),
    ...payload,
  });
  const durationMs = getDurationMs(event.startedAt, finishedAt);

  try {
    if (db.UpdateRunEvent && event.id) {
      await db.UpdateRunEvent.update({
        status,
        finishedAt,
        durationMs,
        payload: mergedPayload,
      }, { where: { id: event.id } });
    }
  } catch (error) {
    emitAuditInternalError("[updateAudit] failed to update event", error);
  }

  emitStructuredAuditLog("event_finished", {
    runId: traceContext.runId,
    traceId: traceContext.traceId,
    rootTraceId: traceContext.rootTraceId,
    sequence: event.sequence,
    stage: event.stage,
    status,
    durationMs,
    payload: mergedPayload,
  });

  return {
    ...event,
    status,
    finishedAt,
    durationMs,
    payload: mergedPayload,
  };
}

async function completeRun(traceContext, options = {}) {
  if (!traceContext) {
    return null;
  }

  const status = options.status || "success";
  let eventStatus = status;
  if (status === "failed") {
    eventStatus = "failed";
  } else if (status === "success") {
    eventStatus = "success";
  }
  const finishedAt = options.finishedAt || new Date();
  const startedAt = traceContext.startedAt || finishedAt;
  const summary = sanitizePayload(options.summary || null);

  const runFinishedEvent = await startEvent(traceContext, "run_finished", {
    status,
    summary,
    ...sanitizePayload(options.payload),
  });
  await finishEvent(traceContext, runFinishedEvent, eventStatus, {
    status,
    summary,
    ...sanitizePayload(options.payload),
  });

  await updateRunContext(traceContext, {
    status,
    finishedAt,
    durationMs: getDurationMs(startedAt, finishedAt),
    summary,
  });

  return traceContext;
}

async function failRun(traceContext, error, options = {}) {
  if (!traceContext) {
    return null;
  }

  const normalizedError = normalizeError(error, options.stage || "unknown");
  const finishedAt = options.finishedAt || new Date();
  const recovery = getDataRecovery(error);
  const summary = sanitizePayload(recovery ? { ...options.summary, dataRecovery: recovery } : options.summary || null);
  const payload = sanitizePayload({
    ...options.payload,
    ...normalizedError,
  });

  const runFailedEvent = await startEvent(traceContext, "run_failed", payload);
  await finishEvent(traceContext, runFailedEvent, "failed", payload);

  await updateRunContext(traceContext, {
    status: options.status || "failed",
    finishedAt,
    durationMs: getDurationMs(traceContext.startedAt || finishedAt, finishedAt),
    errorStage: normalizedError.errorStage,
    errorClass: normalizedError.errorClass,
    errorCode: normalizedError.errorCode,
    errorMessage: normalizedError.errorMessage,
    summary,
  });

  return traceContext;
}

async function recordInstantEvent(traceContext, stage, payload = {}, status = "success") {
  const event = await startEvent(traceContext, stage, payload);
  return finishEvent(traceContext, event, status, payload);
}

const DEFAULT_RUN_RETENTION_DAYS = 30;
const DEFAULT_FAILED_RUN_RETENTION_DAYS = 90;
const DEFAULT_RETENTION_BATCH_SIZE = 1000;
const DEFAULT_RETENTION_MAX_RUNTIME_SECONDS = 300;

function parseNonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeCleanupOptions(options = {}) {
  if (typeof options !== "object" || Array.isArray(options)) {
    const retentionDays = parseNonNegativeInteger(options, DEFAULT_RUN_RETENTION_DAYS);
    return {
      retentionDays,
      failedRetentionDays: retentionDays,
      batchSize: DEFAULT_RETENTION_BATCH_SIZE,
      maxRuntimeSeconds: DEFAULT_RETENTION_MAX_RUNTIME_SECONDS,
      limit: null,
      dryRun: false,
      now: new Date(),
    };
  }

  return {
    retentionDays: parseNonNegativeInteger(
      options.retentionDays,
      DEFAULT_RUN_RETENTION_DAYS
    ),
    failedRetentionDays: parseNonNegativeInteger(
      options.failedRetentionDays,
      DEFAULT_FAILED_RUN_RETENTION_DAYS
    ),
    batchSize: Math.max(1, parseNonNegativeInteger(
      options.batchSize,
      DEFAULT_RETENTION_BATCH_SIZE
    )),
    maxRuntimeSeconds: Math.max(1, parseNonNegativeInteger(
      options.maxRuntimeSeconds,
      DEFAULT_RETENTION_MAX_RUNTIME_SECONDS
    )),
    limit: options.limit === undefined || options.limit === null
      ? null
      : Math.max(1, parseNonNegativeInteger(options.limit, 1)),
    dryRun: options.dryRun === true,
    now: hydrateDate(options.now) || new Date(),
  };
}

function buildExpiredRunWhere(options) {
  const conditions = [];
  const failedCutoff = options.failedRetentionDays > 0
    ? new Date(options.now.getTime() - (options.failedRetentionDays * 24 * 60 * 60 * 1000))
    : null;
  const standardCutoff = options.retentionDays > 0
    ? new Date(options.now.getTime() - (options.retentionDays * 24 * 60 * 60 * 1000))
    : null;

  if (failedCutoff) {
    conditions.push({
      status: "failed",
      startedAt: { [Op.lt]: failedCutoff },
    });
  }

  if (standardCutoff) {
    conditions.push({
      status: { [Op.ne]: "failed" },
      startedAt: { [Op.lt]: standardCutoff },
    });
  }

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];
  return { [Op.or]: conditions };
}

async function cleanupExpiredRuns(cleanupOptions = {}) {
  if (!db.UpdateRun || !db.UpdateRunEvent) {
    return {
      deletedRuns: 0,
      deletedEvents: 0,
      batches: 0,
      matchedRuns: 0,
    };
  }

  const options = normalizeCleanupOptions(cleanupOptions);
  const where = buildExpiredRunWhere(options);
  if (!where) {
    return {
      deletedRuns: 0,
      deletedEvents: 0,
      batches: 0,
      matchedRuns: 0,
      disabled: true,
    };
  }

  try {
    if (options.dryRun) {
      const matchedRuns = await db.UpdateRun.count({ where });
      const oldestRun = await db.UpdateRun.findOne({
        where,
        attributes: ["startedAt"],
        order: [["startedAt", "ASC"], ["id", "ASC"]],
      });

      return {
        deletedRuns: 0,
        deletedEvents: 0,
        batches: 0,
        matchedRuns,
        oldestStartedAt: oldestRun?.startedAt || null,
        dryRun: true,
      };
    }

    const startedAt = Date.now();
    let deletedRuns = 0;
    let deletedEvents = 0;
    let batches = 0;

    while ((Date.now() - startedAt) < (options.maxRuntimeSeconds * 1000)) {
      const remaining = options.limit === null ? options.batchSize : options.limit - deletedRuns;
      if (remaining <= 0) break;

      // Batches are intentionally sequential to keep database load bounded.
      // eslint-disable-next-line no-await-in-loop
      const expiredRuns = await db.UpdateRun.findAll({
        where,
        attributes: ["id"],
        order: [["id", "ASC"]],
        limit: Math.min(options.batchSize, remaining),
      });
      const runIds = expiredRuns.map((run) => run.id);
      if (runIds.length === 0) break;

      // eslint-disable-next-line no-await-in-loop
      const result = await db.sequelize.transaction(async (transaction) => {
        const batchDeletedEvents = await db.UpdateRunEvent.destroy({
          where: { runId: { [Op.in]: runIds } },
          transaction,
        });
        const batchDeletedRuns = await db.UpdateRun.destroy({
          where: { id: { [Op.in]: runIds } },
          transaction,
        });

        return {
          deletedEvents: batchDeletedEvents,
          deletedRuns: batchDeletedRuns,
        };
      });

      deletedEvents += result.deletedEvents;
      deletedRuns += result.deletedRuns;
      batches += 1;

      if (result.deletedRuns === 0 || runIds.length < Math.min(options.batchSize, remaining)) {
        break;
      }
    }

    emitStructuredAuditLog("cleanup_completed", {
      retentionDays: options.retentionDays,
      failedRetentionDays: options.failedRetentionDays,
      deletedRuns,
      deletedEvents,
      batches,
    });

    return {
      deletedRuns,
      deletedEvents,
      batches,
      matchedRuns: deletedRuns,
      runtimeMs: Date.now() - startedAt,
    };
  } catch (error) {
    emitAuditInternalError("[updateAudit] failed to cleanup expired runs", error);
    throw error;
  }
}

module.exports = {
  createHash,
  getItemCount,
  normalizeError,
  recordInstantEvent,
  sanitizeHeaderNames,
  sanitizePayload,
  sanitizeQueryPreview,
  sanitizeRouteSnippet,
  sanitizeSnippet,
  serializeResponsePreview,
  startRun,
  startEvent,
  finishEvent,
  completeRun,
  failRun,
  updateRunContext,
  cleanupExpiredRuns,
  buildExpiredRunWhere,
  normalizeCleanupOptions,
};
