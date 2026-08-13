const { getPlatformIntelligencePolicy } = require("../platformSettings/runtime");

const CHARTBREW_AI_DISABLED_MESSAGE = "Chartbrew AI is turned off. A platform administrator can turn it on in Settings.";

function getWorkspaceOrchestratorPolicy() {
  return getPlatformIntelligencePolicy().workspaceOrchestrator;
}

module.exports = {
  CHARTBREW_AI_DISABLED_MESSAGE,
  getWorkspaceOrchestratorPolicy,
};
