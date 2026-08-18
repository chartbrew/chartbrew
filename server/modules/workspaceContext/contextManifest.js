const { getSerializedCharacterCount } = require("./contextLimits");

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

function buildContextManifest({
  characterCount,
  context = {},
  externalProviderUsed = false,
  modelRoleCalls = {},
  projectIds = [],
  purpose,
  resultStatus = "deterministic",
  serverToolCallCount = 0,
  truncated = false,
}) {
  const activity = context.activity || {};
  return {
    characterCount: Number.isFinite(characterCount)
      ? Math.max(0, Math.round(characterCount))
      : getSerializedCharacterCount(context),
    contextSections: Object.keys(context).filter((key) => key !== "coverage").sort(),
    externalProviderUsed,
    factCounts: {
      alerts: count(activity.alerts || context.alerts),
      businessProfiles: context.business_profile ? 1 : 0,
      evaluations: count(activity.evaluations),
      health: count(activity.health || context.health),
      learning: count(context.learning),
      observations: count(activity.changes),
    },
    manifestVersion: 1,
    modelRoleCalls: {
      planner: Number(modelRoleCalls.planner) || 0,
      synthesis: Number(modelRoleCalls.synthesis) || 0,
      worker: Number(modelRoleCalls.worker) || 0,
    },
    projectCount: new Set(projectIds.map(Number)).size,
    purpose,
    resultStatus,
    serverToolCallCount: Number(serverToolCallCount) || 0,
    truncated: Boolean(truncated),
  };
}

module.exports = { buildContextManifest };
