/**
 * Tool Milestone Messages for AI Orchestrator
 *
 * Defines user-friendly progress messages for each tool execution.
 * Messages are randomly selected to provide variety in user experience.
 */

const TOOL_MILESTONES = {
  list_connections: {
    start: [
      "🔌 Finding your database connections...",
      "🔍 Looking up available databases...",
      "📋 Checking which databases you have...",
      "🗄️ Scanning for database connections...",
      "🔎 Discovering your data sources...",
    ],
    error: [
      "❌ Couldn't find database connections",
      "❌ Failed to list connections",
      "❌ Unable to locate databases",
    ]
  },

  get_schema: {
    start: [
      "🔍 Checking the schema...",
      "📊 Analyzing database structure...",
      "🗂️ Reading table definitions...",
      "📐 Examining the database schema...",
      "🔎 Looking at your data structure...",
    ],
    error: [
      "❌ Failed to read database schema",
      "❌ Couldn't access schema information",
      "❌ Schema analysis failed",
    ]
  },

  generate_query: {
    start: [
      "✍️ Writing the query...",
      "📝 Generating SQL query...",
      "🔨 Crafting the database query...",
      "💭 Composing the query...",
      "⚡ Building the SQL...",
    ],
    error: [
      "❌ Failed to generate query",
      "❌ Couldn't write the query",
      "❌ Query generation failed",
    ]
  },

  validate_query: {
    start: [
      "✅ Validating the query...",
      "🔍 Checking query syntax...",
      "🛡️ Verifying query safety...",
      "📋 Reviewing the query...",
      "🔎 Validating SQL syntax...",
    ],
    error: [
      "❌ Query validation failed",
      "❌ Invalid query syntax",
      "❌ Query check failed",
    ]
  },

  run_query: {
    start: [
      "⚡ Running the query...",
      "🚀 Executing database query...",
      "💨 Fetching your data...",
      "🔄 Processing the query...",
      "📊 Retrieving results...",
    ],
    error: [
      "❌ Query execution failed",
      "❌ Couldn't run the query",
      "❌ Database query failed",
    ]
  },

  summarize: {
    start: [
      "📊 Analyzing the results...",
      "🔍 Summarizing the data...",
      "💭 Processing the information...",
      "📈 Evaluating the results...",
      "🧮 Crunching the numbers...",
    ],
    error: [
      "❌ Failed to analyze results",
      "❌ Couldn't summarize data",
      "❌ Analysis failed",
    ]
  },

  suggest_chart: {
    start: [
      "🎨 Finding the best visualization...",
      "📊 Suggesting chart types...",
      "🎯 Determining optimal chart...",
      "💡 Recommending visualization...",
      "🔍 Analyzing data for chart suggestions...",
    ],
    error: [
      "❌ Failed to suggest chart type",
      "❌ Couldn't recommend visualization",
      "❌ Chart suggestion failed",
    ]
  },

  create_dataset: {
    start: [
      "🗂️ Creating dataset...",
      "📦 Setting up data source...",
      "🔧 Configuring dataset...",
      "📊 Building dataset...",
      "⚙️ Preparing data source...",
    ],
    error: [
      "❌ Failed to create dataset",
      "❌ Couldn't set up dataset",
      "❌ Dataset creation failed",
    ]
  },

  create_chart: {
    start: [
      "📊 Creating the chart...",
      "🎨 Building visualization...",
      "📈 Generating chart...",
      "🖼️ Crafting the chart...",
      "✨ Creating your visualization...",
    ],
    error: [
      "❌ Failed to create chart",
      "❌ Couldn't build chart",
      "❌ Chart creation failed",
    ]
  },

  update_dataset: {
    start: [
      "🔄 Updating dataset...",
      "📝 Modifying data source...",
      "⚙️ Reconfiguring dataset...",
      "🔧 Adjusting dataset settings...",
      "💾 Saving dataset changes...",
    ],
    error: [
      "❌ Failed to update dataset",
      "❌ Couldn't modify dataset",
      "❌ Dataset update failed",
    ]
  },

  update_chart: {
    start: [
      "🔄 Updating the chart...",
      "📊 Modifying visualization...",
      "🎨 Adjusting chart settings...",
      "✏️ Editing the chart...",
      "💾 Saving chart changes...",
    ],
    error: [
      "❌ Failed to update chart",
      "❌ Couldn't modify chart",
      "❌ Chart update failed",
    ]
  },

  create_temporary_chart: {
    start: [
      "🎨 Creating preview chart...",
      "📊 Building temporary visualization...",
      "✨ Generating chart preview...",
      "🖼️ Crafting preview chart...",
      "⚡ Creating temporary chart...",
    ],
    error: [
      "❌ Failed to create preview",
      "❌ Couldn't generate temporary chart",
      "❌ Preview creation failed",
    ]
  },

  move_chart_to_dashboard: {
    start: [
      "🚀 Adding chart to dashboard...",
      "📌 Moving chart to dashboard...",
      "💾 Saving chart to dashboard...",
      "🗂️ Placing chart on dashboard...",
      "✅ Adding to dashboard...",
    ],
    error: [
      "❌ Failed to add chart to dashboard",
      "❌ Couldn't move chart",
      "❌ Dashboard addition failed",
    ]
  },

  disambiguate: {
    start: [
      "🤔 Clarifying your request...",
      "💭 Understanding the options...",
      "🔍 Looking for clarification...",
      "📋 Reviewing possibilities...",
      "🎯 Narrowing down choices...",
    ],
    error: [
      "❌ Failed to clarify request",
      "❌ Couldn't disambiguate",
      "❌ Clarification failed",
    ]
  }
};

/**
 * Get a random milestone message for a tool
 * @param {string} toolName - The name of the tool
 * @param {string} phase - 'start' or 'error'
 * @returns {string} - A random message from the array
 */
function getToolMilestone(toolName, phase = "start") {
  const tool = TOOL_MILESTONES[toolName];
  if (!tool || !tool[phase]) {
    // Fallback for unknown tools
    if (phase === "error") {
      return `❌ ${toolName} failed`;
    }
    return `⚙️ Running ${toolName}...`;
  }

  const messages = tool[phase];
  return messages[Math.floor(Math.random() * messages.length)];
}

module.exports = {
  TOOL_MILESTONES,
  getToolMilestone
};
