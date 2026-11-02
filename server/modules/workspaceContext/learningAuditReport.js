function serializeSignalScope(signal = {}) {
  return {
    projectScope: signal.scope?.projectId ? "project" : "workspace",
    userScope: signal.scope?.userScope || "current_user",
  };
}

function buildLearningSignalAuditReport(projection = {}) {
  const items = Array.isArray(projection.items) ? projection.items : [];
  return {
    lowSample: Boolean(projection.lowSample),
    reportVersion: 1,
    signals: items.map((signal) => ({
      expiresAt: signal.expiresAt || null,
      scope: serializeSignalScope(signal),
      signalId: signal.signalId,
      signalType: signal.signalType,
      source: signal.provenance?.sourceType || signal.signalType,
      strength: signal.strength,
    })),
    totalSignals: items.length,
    truncated: Boolean(projection.truncated),
  };
}

module.exports = {
  buildLearningSignalAuditReport,
  serializeSignalScope,
};
