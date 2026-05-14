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
  sourceValidateConfiguration,
};
