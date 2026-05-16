const {
  findSourceForConnection,
  getSourceById,
  getSources,
} = require("../../../sources");
const { isSourceServerEnabled } = require("../../../sources/sourceAvailability");

function sourceSupportsOrchestrator(source) {
  const supportsQueryGeneration = Boolean(
    source?.capabilities?.data?.supportsQuery
    && source?.capabilities?.ai?.canGenerateQueries
    && source?.backend?.runDataRequest
    && source?.backend?.ai?.generateQuery
  );
  const supportsSourceTools = Boolean(
    source?.capabilities?.ai?.hasTools
    && source?.backend?.runDataRequest
    && source?.backend?.ai
  );

  return Boolean(
    source
    && isSourceServerEnabled(source)
    && (supportsQueryGeneration || supportsSourceTools)
  );
}

function sourceUsesSourceOwnedConfiguration(source) {
  return Boolean(
    source?.capabilities?.ai?.hasTools
    && source?.backend?.ai
    && !source?.capabilities?.ai?.canGenerateQueries
  );
}

function getOrchestratorSources() {
  return getSources().filter(sourceSupportsOrchestrator);
}

function getSupportedConnectionTypes() {
  return [...new Set(getOrchestratorSources().map((source) => source.type))];
}

function getSupportedSourceIds() {
  return getOrchestratorSources().map((source) => source.id);
}

function getSupportedDialectIds() {
  return [...new Set(getOrchestratorSources().flatMap((source) => [
    source.id,
    source.type,
    source.subType,
  ].filter(Boolean)))];
}

function isConnectionSupported(type, subType) {
  return Boolean(getSupportedSourceForConnection({ type, subType }));
}

function getSupportedSourceForConnection(connection) {
  const source = findSourceForConnection(connection);
  return sourceSupportsOrchestrator(source) ? source : null;
}

function requireSupportedSourceForConnection(connection) {
  const source = getSupportedSourceForConnection(connection);

  if (!source) {
    const sourceName = `${connection?.type || "unknown"}${connection?.subType ? `/${connection.subType}` : ""}`;
    throw new Error(`Connection source '${sourceName}' is not supported by the AI orchestrator. Supported sources: ${formatSupportedSourceList()}.`);
  }

  return source;
}

function getSourceByDialect(dialect) {
  if (!dialect) {
    return null;
  }

  const sources = getOrchestratorSources();
  return sources.find((source) => {
    return source.id === dialect || source.subType === dialect || source.type === dialect;
  }) || null;
}

function requireSourceById(sourceId) {
  const source = getSourceById(sourceId);

  if (!sourceSupportsOrchestrator(source)) {
    throw new Error(`Source '${sourceId}' is not supported by the AI orchestrator.`);
  }

  return source;
}

function formatSupportedSourceList() {
  return getOrchestratorSources().map((source) => source.name).join(", ");
}

function formatSupportedSourceBullets() {
  return getOrchestratorSources()
    .map((source) => `- ${source.name}: ${source.description}`)
    .join("\n");
}

module.exports = {
  formatSupportedSourceBullets,
  formatSupportedSourceList,
  getOrchestratorSources,
  getSourceByDialect,
  getSupportedConnectionTypes,
  getSupportedDialectIds,
  getSupportedSourceIds,
  getSupportedSourceForConnection,
  isConnectionSupported,
  requireSourceById,
  requireSupportedSourceForConnection,
  sourceUsesSourceOwnedConfiguration,
  sourceSupportsOrchestrator,
};
