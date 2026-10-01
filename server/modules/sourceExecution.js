const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const { Op } = require("sequelize");
const { DateTime } = require("luxon");

const db = require("../models/models");
const { normalizeCleanupOptions } = require("./updateAudit");

const contextStorage = new AsyncLocalStorage();
const ACTIVITIES = new Set(["manual", "preview", "schedule", "report", "alert", "ai", "api", "mcp", "background"]);
const TRIGGER_ACTIVITIES = {
  chart_manual: "manual",
  dashboard_manual: "manual",
  chart_auto: "schedule",
  dashboard_auto: "schedule",
  data_api: "api",
  mcp: "mcp",
};

function withSourceExecutionContext(context, operation, inheritActivity = true) {
  const parent = contextStorage.getStore() || {};
  if (parent.teamId != null && context.teamId != null && Number(parent.teamId) !== Number(context.teamId)) {
    throw executionError("SOURCE_EXECUTION_CONTEXT_INVALID");
  }
  return contextStorage.run({
    ...parent,
    ...Object.fromEntries(Object.entries(context).filter(([, value]) => value != null)),
    activity: inheritActivity ? parent.activity || context.activity : context.activity,
  }, operation);
}

function positiveId(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function executionError(code = "SOURCE_EXECUTION_UNAVAILABLE") {
  const error = new Error("The data request could not start. Try again shortly.");
  error.code = code;
  return error;
}

function logExecutionError(operation, record, error) {
  console.error("[sourceExecution]", { // eslint-disable-line no-console
    operation,
    executionId: record?.id,
    teamId: record?.teamId,
    sourceId: record?.sourceId,
    code: /^[A-Z0-9_]{1,64}$/.test(error?.code || "") ? error.code : "EXECUTION_RECORD_ERROR",
  });
}

function isTransient(error) {
  return /^(SequelizeConnection|SequelizeHost|SequelizeTimeout)/.test(error?.name || "")
    || ["ECONNRESET", "ETIMEDOUT", "EPIPE", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT", "40001", "40P01", "SQLITE_BUSY"]
      .includes(error?.original?.code || error?.code);
}

async function retryWrite(operation) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      return await operation();
    } catch (error) {
      if (attempt >= 2 || !isTransient(error)) throw error;
      // oxlint-disable-next-line no-await-in-loop
      await delay(50 * (attempt + 1));
    }
  }
}

function buildRecord({ connection, dataRequest, auditContext, chartId, cacheHit }) {
  const context = contextStorage.getStore() || {};
  const trace = auditContext?.traceContext || {};
  const teamId = positiveId(connection?.team_id);
  const connectionId = positiveId(connection?.id);
  const activity = context.activity || TRIGGER_ACTIVITIES[context.triggerType || trace.triggerType] || "manual";
  if (cacheHit !== false || !teamId || !connectionId || !ACTIVITIES.has(activity)
    || (context.teamId != null && positiveId(context.teamId) !== teamId)
    || (trace.teamId != null && positiveId(trace.teamId) !== teamId)) {
    throw executionError("SOURCE_EXECUTION_CONTEXT_INVALID");
  }
  // Source protocols load this module before the registry is ready.
  // oxlint-disable-next-line global-require
  const { getSourceForConnection } = require("../sources");
  return {
    id: randomUUID(),
    teamId,
    connectionId,
    sourceId: getSourceForConnection(connection).id,
    activity,
    status: "pending",
    cacheHit: false,
    startedAt: new Date(),
    finishedAt: null,
    projectId: positiveId(context.projectId || trace.projectId),
    chartId: positiveId(chartId || context.chartId || trace.chartId),
    datasetId: positiveId(dataRequest?.dataset_id || context.datasetId || trace.datasetId),
    dataRequestId: positiveId(dataRequest?.id || context.dataRequestId || trace.dataRequestId),
    runId: positiveId(trace.runId || context.runId),
  };
}

async function persistStart(model, record) {
  return retryWrite(async () => {
    try {
      return await model.create(record);
    } catch (error) {
      const existing = await model.findByPk(record.id);
      if (existing) {
        const matches = Object.keys(record).every((key) => {
          if (record[key] instanceof Date) return new Date(existing[key]).getTime() === record[key].getTime();
          return existing[key] === record[key];
        });
        if (matches) return existing;
        throw executionError("SOURCE_EXECUTION_CONFLICT");
      }
      throw error;
    }
  });
}

async function persistOutcome(model, record, status) {
  const values = { status, finishedAt: new Date() };
  try {
    return await retryWrite(async () => {
      await model.update(values, { where: { id: record.id, status: "pending" } });
      const saved = await model.findByPk(record.id);
      if (!saved || saved.status !== status) throw executionError("SOURCE_EXECUTION_CONFLICT");
      return saved.toJSON ? saved.toJSON() : saved;
    });
  } catch (error) {
    logExecutionError("finish", record, error);
    return null;
  }
}

async function runSourceExecution(options, operation, dependencies = {}) {
  const record = buildRecord(options);
  const model = dependencies.model || db.SourceExecution;
  const before = dependencies.beforeSourceExecution || module.exports.beforeSourceExecution;
  const after = dependencies.afterSourceExecution || module.exports.afterSourceExecution;
  try {
    await persistStart(model, record);
  } catch (error) {
    logExecutionError("start", record, error);
    throw executionError();
  }

  const finish = async (status) => {
    const saved = await persistOutcome(model, record, status);
    if (saved) {
      try {
        await after(saved);
      } catch (error) {
        logExecutionError("after", record, error);
      }
    }
  };

  let result;
  try {
    await before({ ...record });
    result = await operation();
  } catch (error) {
    await finish("failed");
    throw error;
  }
  await finish("success");
  return result;
}

async function countSuccessfulExecutions({ teamId, from, to }, model = db.SourceExecution) {
  const start = new Date(from);
  const end = new Date(to);
  if (!positiveId(teamId) || !from || !to || !Number.isFinite(start.getTime())
    || !Number.isFinite(end.getTime()) || start >= end) {
    throw new Error("A team and a valid time range are required.");
  }
  return model.count({ where: {
    teamId: positiveId(teamId),
    status: "success",
    cacheHit: false,
    finishedAt: { [Op.gte]: start, [Op.lt]: end },
  } });
}

async function reportPendingExecutions({ limit = 100 } = {}, model = db.SourceExecution) {
  const where = { status: "pending" };
  const [count, records] = await Promise.all([
    model.count({ where }),
    model.findAll({
      where,
      attributes: ["id", "startedAt"],
      order: [["startedAt", "ASC"], ["id", "ASC"]],
      limit: Math.min(positiveId(limit) || 100, 1000),
      raw: true,
    }),
  ]);
  return { count, oldestStartedAt: records[0]?.startedAt || null, records };
}

async function cleanupSourceExecutions(rawOptions = {}, model = db.SourceExecution) {
  const options = normalizeCleanupOptions(rawOptions);
  const cutoff = DateTime.fromJSDate(options.now, { zone: "utc" }).minus({ months: 13 }).toJSDate();
  const where = {
    startedAt: { [Op.lt]: cutoff },
    [Op.or]: [
      { status: "pending" },
      { status: { [Op.in]: ["success", "failed"] }, finishedAt: { [Op.lt]: cutoff } },
    ],
  };
  if (options.dryRun) {
    return { dryRun: true, matchedRecords: await model.count({ where }), deletedRecords: 0, cutoff };
  }
  const started = Date.now();
  let deletedRecords = 0;
  let batches = 0;
  while (Date.now() - started < options.maxRuntimeSeconds * 1000) {
    const remaining = options.limit === null ? options.batchSize : options.limit - deletedRecords;
    if (remaining <= 0) break;
    // oxlint-disable-next-line no-await-in-loop
    const records = await model.findAll({
      where,
      attributes: ["id"],
      order: [["startedAt", "ASC"], ["id", "ASC"]],
      limit: Math.min(options.batchSize, remaining),
      raw: true,
    });
    if (records.length === 0) break;
    // oxlint-disable-next-line no-await-in-loop
    const deleted = await model.destroy({ where: { ...where, id: { [Op.in]: records.map((record) => record.id) } } });
    deletedRecords += deleted;
    batches += 1;
    if (deleted === 0) break;
  }
  return { deletedRecords, batches, cutoff, runtimeMs: Date.now() - started };
}

module.exports = {
  beforeSourceExecution: async () => {},
  afterSourceExecution: async () => {},
  countSuccessfulExecutions,
  cleanupSourceExecutions,
  reportPendingExecutions,
  runSourceExecution,
  withSourceExecutionContext,
};
