const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");
const { Op, col, fn } = require("sequelize");

const db = require("../../models/models");

const storage = new AsyncLocalStorage();
const responseRecords = new WeakMap();

function tokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeUsage(usage) {
  const input = tokenCount(usage?.input_tokens ?? usage?.prompt_tokens);
  const output = tokenCount(usage?.output_tokens ?? usage?.completion_tokens);
  return {
    prompt_tokens: input,
    completion_tokens: output,
    total_tokens: tokenCount(usage?.total_tokens)
      ?? (input !== null && output !== null ? input + output : null),
    cached_tokens: tokenCount(usage?.input_tokens_details?.cached_tokens
      ?? usage?.prompt_tokens_details?.cached_tokens),
    reasoning_tokens: tokenCount(usage?.output_tokens_details?.reasoning_tokens
      ?? usage?.completion_tokens_details?.reasoning_tokens),
  };
}

function aggregateUsage(records) {
  return records.reduce((total, record) => ({
    prompt_tokens: total.prompt_tokens + (record.prompt_tokens || 0),
    completion_tokens: total.completion_tokens + (record.completion_tokens || 0),
    total_tokens: total.total_tokens + (record.total_tokens || 0),
  }), { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
}

async function withAiUsageContext(context, operation) {
  const parent = storage.getStore();
  const teamId = Number(context.teamId ?? parent?.teamId);
  if (!Number.isSafeInteger(teamId) || teamId <= 0
    || (parent && parent.teamId !== teamId)) {
    throw new Error("A valid team is required to record AI use.");
  }
  if (context.activity && !["interactive", "background", "internal"].includes(context.activity)) {
    throw new Error("Choose a valid AI usage activity.");
  }
  const scope = {
    ...parent,
    ...context,
    teamId,
    requestId: parent?.requestId || randomUUID(),
    activity: context.activity || parent?.activity || "interactive",
    records: parent?.records || [],
  };
  return storage.run(scope, async () => {
    const result = await operation();
    if (!Array.isArray(result?.usageRecords)) return result;
    if (result.contextManifest && scope.records.length) {
      await db.AiUsage.update({ context_manifest: result.contextManifest }, {
        where: { id: scope.records.map((record) => record.id), team_id: teamId },
      });
    }
    return {
      ...result,
      requestId: scope.requestId,
      usageComplete: scope.records.every((record) => ["reported", "rejected"].includes(record.usage_status)),
      usage: aggregateUsage(scope.records),
      usageRecords: scope.records.map((record) => ({
        ...record,
        context_manifest: result.contextManifest || null,
      })),
    };
  });
}

async function callAiProvider({ client, request, options, purpose, api = "responses" }) {
  const context = storage.getStore();
  if (!context) throw new Error("AI use must have a team context.");
  const record = {
    id: randomUUID(),
    request_id: context.requestId,
    team_id: context.teamId,
    conversation_id: context.conversationId || null,
    provider: "openai",
    model: request.model,
    purpose,
    activity: context.activity,
    usage_status: "pending",
    cost_micros: null,
    ...normalizeUsage(null),
  };
  await db.AiUsage.create(record);
  context.records.push(record);
  const started = Date.now();
  let response;
  let callError;
  let attempted = false;
  try {
    await module.exports.beforeAiCall({ ...record });
    const endpoint = api === "responses" ? client.responses : client.chat.completions;
    attempted = true;
    response = await endpoint.create(request, { ...options, maxRetries: 0 });
  } catch (error) {
    callError = error;
  }
  const usage = normalizeUsage(response?.usage);
  const completedRecord = {
    ...usage,
    elapsed_ms: Date.now() - started,
    model: response?.model || request.model,
    provider_response_id: response?.id || null,
    usage_status: usage.prompt_tokens !== null && usage.completion_tokens !== null
      && usage.total_tokens !== null ? "reported" : "unknown",
    provider_usage: response?.usage || null,
  };
  if (!attempted) completedRecord.usage_status = "rejected";
  const [updated] = await db.AiUsage.update(completedRecord, {
    where: { id: record.id, team_id: record.team_id },
  });
  if (updated !== 1) throw new Error("The AI usage record could not be saved.");
  Object.assign(record, completedRecord);
  if (response) responseRecords.set(response, record);
  try {
    await module.exports.afterAiUsage({ ...record });
  } catch (error) {
    // The saved record can be read again if the Cloud callback fails.
    console.error("[aiUsage] Callback failed", { id: record.id }); // oxlint-disable-line no-console
  }
  if (callError) throw callError;
  return response;
}

async function getUsageSummary({ teamId, from, to, activity }, model = db.AiUsage) {
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isSafeInteger(Number(teamId)) || Number(teamId) <= 0 || !from || !to
    || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end
    || (activity && !["interactive", "background", "internal"].includes(activity))) {
    throw new Error("A team and a valid usage period are required.");
  }
  return model.findAll({
    where: {
      team_id: Number(teamId),
      createdAt: { [Op.gte]: start, [Op.lt]: end },
      ...(activity ? { activity } : {}),
    },
    attributes: [
      "provider", "model", "purpose", "activity", "usage_status",
      [fn("COUNT", col("id")), "records"],
      ...["prompt_tokens", "completion_tokens", "total_tokens", "cached_tokens", "reasoning_tokens"]
        .map((field) => [fn("SUM", col(field)), field]),
    ],
    group: ["provider", "model", "purpose", "activity", "usage_status"],
    raw: true,
  });
}

module.exports = {
  afterAiUsage: async () => {},
  beforeAiCall: async () => {},
  aggregateUsage,
  callAiProvider,
  getUsageSummary,
  getResponseUsageRecord: (response) => responseRecords.get(response),
  normalizeUsage,
  withAiUsageContext,
};
