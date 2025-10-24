const { orchestrate, availableTools } = require("../modules/ai/orchestrator");

async function getOrchestration(teamId, question, conversationHistory) {
  const orchestration = await orchestrate(teamId, question, conversationHistory);

  return orchestration;
}

async function getAvailableTools() {
  const tools = await availableTools();
  return tools;
}

module.exports = {
  getOrchestration,
  getAvailableTools,
};
