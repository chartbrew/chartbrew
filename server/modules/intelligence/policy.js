const { getPlatformIntelligencePolicy } = require("../platformSettings/runtime");

let registeredProvider = null;

function clampMaximum(value, ceiling) {
  if (!Number.isInteger(value) || value <= 0) return ceiling;
  return Math.min(value, ceiling);
}

function mergeDatasetIntelligencePolicy(instancePolicy, teamPolicy = {}) {
  return {
    enabled: instancePolicy.enabled && teamPolicy.enabled !== false,
    autoProfile: instancePolicy.autoProfile && teamPolicy.autoProfile !== false,
    profileTtlHours: Math.max(
      instancePolicy.profileTtlHours,
      Number.isInteger(teamPolicy.profileTtlHours) ? teamPolicy.profileTtlHours : 0
    ),
    maxSampleRows: clampMaximum(teamPolicy.maxSampleRows, instancePolicy.maxSampleRows),
    maxFields: clampMaximum(teamPolicy.maxFields, instancePolicy.maxFields),
    llmEnrichment: instancePolicy.llmEnrichment && teamPolicy.llmEnrichment !== false,
    backfillBatchSize: clampMaximum(
      teamPolicy.backfillBatchSize,
      instancePolicy.backfillBatchSize
    ),
  };
}

async function getIntelligencePolicy({ teamId } = {}) {
  const instancePolicy = getPlatformIntelligencePolicy();
  if (!registeredProvider) return instancePolicy;

  const teamPolicy = await registeredProvider({
    teamId,
    instancePolicy,
  });

  return {
    ...instancePolicy,
    datasetIntelligence: mergeDatasetIntelligencePolicy(
      instancePolicy.datasetIntelligence,
      teamPolicy?.datasetIntelligence
    ),
  };
}

function registerIntelligencePolicyProvider(provider) {
  if (provider !== null && typeof provider !== "function") {
    throw new Error("Intelligence policy provider must be a function");
  }
  registeredProvider = provider;
}

function resetIntelligencePolicyProvider() {
  registeredProvider = null;
}

module.exports = {
  getIntelligencePolicy,
  mergeDatasetIntelligencePolicy,
  registerIntelligencePolicyProvider,
  resetIntelligencePolicyProvider,
};
