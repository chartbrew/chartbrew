const { getEnvIntelligencePolicy } = require("../intelligence/envPolicyProvider");

function getWorkspaceOrchestratorPolicy() {
  return getEnvIntelligencePolicy().workspaceOrchestrator;
}

module.exports = {
  getWorkspaceOrchestratorPolicy,
};
