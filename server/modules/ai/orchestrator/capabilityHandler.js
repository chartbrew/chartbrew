/**
 * Capability Question Handler for Chartbrew AI
 *
 * Handles detection and response generation for capability/help questions
 * to avoid expensive OpenAI API calls for simple informational queries.
 */

// Check if question is about capabilities/what the AI can do
function isCapabilityQuestion(question) {
  const capabilityPatterns = [
    /what can you do/i,
    /what do you do/i,
    /help/i,
    /capabilities/i,
    /what are your/i,
    /how can you help/i,
    /what can you help/i,
    /tell me about yourself/i,
    /introduce yourself/i,
    /who are you/i,
    /what is chartbrew/i,
    /how does this work/i,
    /how do you work/i,
    /what features/i,
    /what can i ask/i,
    /what questions/i,
    /show me what/i
  ];

  return capabilityPatterns.some((pattern) => pattern.test(question.trim()));
}

// Generate capability response without AI call
function generateCapabilityResponse(semanticLayer) {
  const { connections, projects } = semanticLayer;

  const supportedConnections = connections.filter((c) => ["mysql", "postgres", "mongodb"].includes(c.type));
  const hasConnections = supportedConnections.length > 0;

  let response = `# Welcome to Chartbrew AI Assistant

I'm your intelligent assistant for Chartbrew, designed to help you explore and visualize your data. Here's what I can do for you:

## 🔍 **Data Exploration**
- Query your database connections to answer questions about your data
- Retrieve and analyze data from supported database types
- Generate insights and summaries from your datasets

## 📊 **Chart Creation**
- Create beautiful charts and visualizations from your data
- Suggest the best chart types for your data (line, bar, pie, KPI, etc.)
- Automatically place charts on your dashboards

## 🗄️ **Database Support**
Currently I work with these database types:
- **MySQL** (including Amazon RDS MySQL)
- **PostgreSQL** (including TimescaleDB, Supabase, and Amazon RDS)
- **MongoDB** (standard MongoDB)

*API connections and other data sources will be available in future updates.*

## 💡 **What You Can Ask**
- "Show me sales data for the last month"
- "Create a chart of user growth over time"
- "How many active users do we have?"
- "Compare revenue by product category"
- "Generate a KPI showing total orders today"

## 🚀 **Getting Started**`;

  if (hasConnections) {
    response += `
I can see you have ${supportedConnections.length} database connection${supportedConnections.length > 1 ? "s" : ""} configured. Try asking me questions about your data!`;
  } else {
    response += `

To get started, you'll need to connect a database first. Go to your connections page to add a MySQL, PostgreSQL, or MongoDB database.`;
  }

  response += `

## 📈 **Available Projects**
${projects.map((p) => `- ${p.name} (${p.Charts?.length || 0} charts)`).join("\n")}

Just ask me anything about your data - I'm here to help you discover insights and create stunning visualizations!`;

  return response;
}

module.exports = {
  isCapabilityQuestion,
  generateCapabilityResponse,
};
