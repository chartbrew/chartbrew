/**
 * Capability Question Handler for Chartbrew AI
 *
 * Handles detection and response generation for capability/help questions
 * to avoid expensive OpenAI API calls for simple informational queries.
 */

const {
  formatSupportedSourceList,
  getSupportedSourceForConnection,
} = require("./sourceSupport");

// Check if question is about capabilities/what the AI can do
function isCapabilityQuestion(question) {
  return /^(what can you do|what do you do|what are your capabilities|capabilities|tell me about yourself|introduce yourself|who are you|what is chartbrew|how do you work)[?!.]*$/i
    .test(String(question || "").trim());
}

// Generate capability response without AI call
function generateCapabilityResponse(semanticLayer) {
  const { connections, projects } = semanticLayer;

  const supportedConnections = connections.filter((connection) => getSupportedSourceForConnection(connection));
  const hasConnections = supportedConnections.length > 0;
  const supportedSourceList = formatSupportedSourceList();

  let response = `# What can Chartbrew AI do?

I help you query your data and create charts. Here's what I can do:

⚙️ **Query your data** - Ask questions and I'll retrieve answers from your connected sources

📊 **Create charts** - Turn data into visualizations (line, bar, pie, KPI, etc.)

🔄 **Auto-place charts** - I'll add them to your dashboard automatically

**Supported sources:** ${supportedSourceList}

**Example questions:**
- "Show me sales for the last month"
- "Create a chart of user growth"
- "How many active users do we have?"

**Getting started**`;

  if (hasConnections) {
    response += `
I can see you have ${supportedConnections.length} supported connection${supportedConnections.length > 1 ? "s" : ""} configured. Try asking me questions about your data!`;
  } else {
    response += `

To get started, you'll need to connect a supported source first. Go to your connections page to add one of: ${supportedSourceList}.`;
  }

  response += `

**Your projects:** ${projects.map((p) => `${p.name} (${p.Charts?.length || 0} charts)`).join(", ")}

Ask me anything about your data and I'll help you visualize it!

\`\`\`cb-actions
{
  "version": 1,
  "suggestions": [
    {
      "id": "suggest_data_question",
      "label": "Give me a useful insight from my database",
      "action": "reply"
    },
    {
      "id": "suggest_chart_question",
      "label": "Create an interesting chart",
      "action": "reply"
    },
    {
      "id": "suggest_kpi",
      "label": "Create a KPI chart",
      "action": "reply"
    }
  ]
}
\`\`\`
`;

  return response;
}

module.exports = {
  isCapabilityQuestion,
  generateCapabilityResponse,
};
