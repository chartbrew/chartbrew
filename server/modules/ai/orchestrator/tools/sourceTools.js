const {
  requireSupportedSourceForConnection,
} = require("../sourceSupport");
const {
  normalizeTeamId,
  requireConnectionForTeam,
} = require("./teamScope");

async function getScopedSource({ connection_id, team_id }) {
  if (!team_id) {
    throw new Error("team_id is required");
  }
  if (!connection_id) {
    throw new Error("connection_id is required");
  }

  const normalizedTeamId = normalizeTeamId(team_id);
  const connection = await requireConnectionForTeam(connection_id, normalizedTeamId);
  const source = requireSupportedSourceForConnection(connection);

  return { connection, source };
}

function requireAiTool(source, toolName) {
  const tool = source.backend?.ai?.[toolName];
  if (typeof tool !== "function") {
    throw new Error(`${source.name} does not expose AI tool '${toolName}'`);
  }
  return tool;
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

module.exports = {
  sourceGetCapabilities,
  sourceGetSampleData,
  sourceListResources,
  sourceListTemplates,
  sourceRecommendTemplates,
};
