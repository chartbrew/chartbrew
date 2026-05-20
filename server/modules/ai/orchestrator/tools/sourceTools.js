const {
  requireSupportedSourceForConnection,
} = require("../sourceSupport");
const {
  normalizeTeamId,
  requireConnectionForTeam,
} = require("./teamScope");

async function getScopedSource(payload) {
  const { connection_id, team_id } = payload;
  if (!team_id) {
    throw new Error("team_id is required");
  }
  if (!connection_id) {
    throw new Error("connection_id is required");
  }

  const normalizedTeamId = normalizeTeamId(team_id);
  const connection = await requireConnectionForTeam(connection_id, normalizedTeamId);
  const source = requireSupportedSourceForConnection(connection);

  if (payload.source_id && source.id !== payload.source_id) {
    throw new Error(`This tool only supports ${payload.source_id} connections`);
  }

  return { connection, source };
}

function requireAiTool(source, toolName) {
  const tool = source.backend?.ai?.[toolName];
  if (typeof tool !== "function") {
    throw new Error(`${source.name} does not expose AI tool '${toolName}'`);
  }
  return tool;
}

function requireSourceAction(source, actionName) {
  const allowedActions = source.capabilities?.actions || [];
  if (!allowedActions.includes(actionName)) {
    throw new Error(`${source.name} does not expose source action '${actionName}'`);
  }

  const action = source.backend?.actions?.[actionName];
  if (typeof action !== "function") {
    throw new Error(`${source.name} action '${actionName}' is not available`);
  }

  return action;
}

function mergeQuestionContext(question, originalQuestion) {
  if (!originalQuestion || originalQuestion === question) {
    return question;
  }

  if (!question) {
    return originalQuestion;
  }

  return `${question}\nOriginal user request: ${originalQuestion}`;
}

async function sourceGetCapabilities(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "getCapabilities");

  return tool({ connection });
}

async function sourceListResources(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "listResources");

  return tool({ connection });
}

async function sourceGetSampleData(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "getSampleData");

  return tool({
    connection,
    resource: payload.resource,
    rowLimit: payload.row_limit,
  });
}

async function sourceListTemplates(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "listTemplates");

  return tool({ connection });
}

async function sourceRecommendTemplates(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "recommendTemplates");

  return tool({
    connection,
    question: payload.question,
  });
}

async function sourcePlanDataset(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "planDataset");

  const result = await tool({
    connection,
    question: mergeQuestionContext(payload.question, payload.original_question),
    overrides: payload.overrides || {},
    mode: payload.mode || "preview",
  });

  if (result?.status === "needs_disambiguation") {
    return {
      ...result,
      needs_user_input: true,
      prompt: result.message || "Choose an option before I continue.",
      options: Array.isArray(result.options) ? result.options : [],
    };
  }

  return result;
}

async function sourceResolveContext(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "resolveContext");

  const result = await tool({
    connection,
    question: mergeQuestionContext(payload.question, payload.original_question),
    overrides: payload.overrides || {},
    intent: payload.intent || {},
    mode: payload.mode || "preview",
  });

  if (result?.resolution?.needsDisambiguation === true) {
    return {
      ...result,
      needs_user_input: true,
      prompt: result.resolution.message || "Choose an option before I continue.",
      options: Array.isArray(result.resolution.options) ? result.resolution.options : [],
    };
  }

  return result;
}

async function sourceRunAction(payload) {
  const { connection, source } = await getScopedSource(payload);
  const action = requireSourceAction(source, payload.action);
  const result = await action({
    connection,
    params: payload.params || {},
  });
  const rows = Array.isArray(result) ? result : (result?.values || result?.rows || result?.issues || []);

  if (Array.isArray(rows)) {
    const rowLimit = Math.min(Number(payload.row_limit || payload.params?.maxResults || 25), 50);
    return {
      source: source.id,
      action: payload.action,
      rows: rows.slice(0, rowLimit),
      rowCount: rows.length,
    };
  }

  return {
    source: source.id,
    action: payload.action,
    result,
  };
}

async function sourceSearchRecords(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "searchRecords");

  return tool({
    connection,
    question: mergeQuestionContext(payload.question, payload.original_question),
    resource: payload.resource,
    filters: payload.filters || {},
    jql: payload.jql,
    fields: payload.fields,
    rowLimit: payload.row_limit,
    overrides: payload.overrides || {},
  });
}

async function sourceValidateConfiguration(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "validateConfiguration");

  return tool(payload.configuration, { connection });
}

async function sourcePreviewConfiguration(payload) {
  const { connection, source } = await getScopedSource(payload);
  const tool = requireAiTool(source, "previewConfiguration");

  return tool({
    connection,
    configuration: payload.configuration,
    rowLimit: payload.row_limit,
  });
}

module.exports = {
  sourceGetCapabilities,
  sourceGetSampleData,
  sourceListResources,
  sourceListTemplates,
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceRecommendTemplates,
  sourceResolveContext,
  sourceRunAction,
  sourceSearchRecords,
  sourceValidateConfiguration,
};
