const { getPlatformIntelligencePolicy } = require("../platformSettings/runtime");

const CHARTBREW_AI_DISABLED_MESSAGE = "Chartbrew AI is turned off. A platform administrator can turn it on in Settings.";
const TEAM_AI_DISABLED_MESSAGE = "Chartbrew AI is turned off for this team. A team owner or admin can turn it on in Team settings.";

function getWorkspaceOrchestratorPolicy() {
  return getPlatformIntelligencePolicy().workspaceOrchestrator;
}

module.exports = {
  CHARTBREW_AI_DISABLED_MESSAGE,
  TEAM_AI_DISABLED_MESSAGE,
  getWorkspaceOrchestratorPolicy,
};
