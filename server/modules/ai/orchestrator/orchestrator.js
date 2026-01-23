/**
 * AI Orchestrator for Chartbrew
 *
 * Enables conversational AI interactions for:
 * - Querying data from connected databases
 * - Generating SQL queries from natural language
 * - Creating charts and visualizations
 * - Suggesting appropriate chart types
 *
 * Uses OpenAI's function calling API to orchestrate multi-step workflows.
 *
 * Main entry point: orchestrate(teamId, question, conversationHistory)
 */

const OpenAI = require("openai");
const db = require("../../../models/models");
const socketManager = require("../../socketManager");
const { emitProgressEvent, parseProgressEvents } = require("./responseParser");
const { ENTITY_CREATION_RULES } = require("./entityCreationRules");
const { isCapabilityQuestion, generateCapabilityResponse } = require("./capabilityHandler");

const openAiKey = process.env.NODE_ENV === "production" ? process.env.CB_OPENAI_API_KEY : process.env.CB_OPENAI_API_KEY_DEV;
const openAiModel = process.env.NODE_ENV === "production" ? process.env.CB_OPENAI_MODEL : process.env.CB_OPENAI_MODEL_DEV;
let openaiClient;

if (openAiKey) {
  openaiClient = new OpenAI({
    apiKey: openAiKey,
  });
}

const clientUrl = process.env.NODE_ENV === "production" ? process.env.VITE_APP_CLIENT_HOST : process.env.VITE_APP_CLIENT_HOST_DEV;

// Import tool functions
const {
  listConnections,
  getSchema,
  generateQuery,
  validateQuery,
  runQuery,
  summarize,
  suggestChart,
  createDataset,
  createChart,
  updateDataset,
  updateChart,
  createTemporaryChart,
  moveChartToDashboard,
  disambiguate,
} = require("./tools");
const { chartColors } = require("../../../charts/colors");

// Make global variables available to tool functions
global.openaiClient = openaiClient;
global.openAiModel = openAiModel;
global.clientUrl = clientUrl;

async function availableTools() {
  return [
    {
      name: "list_connections",
      description: "List supported database connections (MySQL, PostgreSQL, MongoDB) available to the project/user context.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          scope: { type: "string", enum: ["all", "dashboard", "recent"], default: "all" }
        },
        required: ["project_id"]
      }
      // returns: { connections: [{ id, type:"postgres"|"mysql"|"mongodb", name }] }
    },
    {
      name: "get_schema",
      description: "Get database schema information for supported connections (MySQL, PostgreSQL, MongoDB).",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          include_samples: { type: "boolean", default: true },
          sample_rows_per_entity: { type: "integer", default: 3 }
        },
        required: ["connection_id"]
      }
      // returns: {
      //   dialect, connection_id, name,
      //   entities:[{ name, kind, columns:[{name,type}], stats?:{rowCount?} }],
      //   samples?:{ [entity]: [{}...] }
      // }
    },
    {
      name: "generate_query",
      description: "Generate SQL queries from natural language for supported database connections (MySQL, PostgreSQL, MongoDB).",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          schema: { type: "object" }, // database schema from get_schema
          hints: { type: "object" }, // optional project-level entity hints
          preferred_dialect: { type: "string", enum: ["postgres", "mysql", "mongodb"] } // supported database types
        },
        required: ["question"]
      }
      // returns: {
      //  status: "ok"|"needs_disambiguation"|"unsupported",
      //  dialect, query, rationale:{table, cols, filters}
      //  disambiguation?: { entityType:"table|column", options:[{label,value}] }
      // }
    },
    {
      name: "validate_query",
      description: "Dry-run validation: syntax check or limit-1 execution.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          dialect: { type: "string" },
          query: { type: "string" },
          max_ms: { type: "integer", default: 3000 }
        },
        required: ["connection_id", "dialect", "query"]
      }
      // returns: { valid: boolean, message?: string, estimatedShape?: { columns:[{name,type}] } }
    },
    {
      name: "run_query",
      description: "Execute SQL queries on supported database connections (MySQL, PostgreSQL, MongoDB) with guardrails.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          dialect: { type: "string", enum: ["mysql", "postgres", "mongodb"] },
          query: { type: "string" },
          params: { type: "object" },
          row_limit: { type: "integer", default: 1000 },
          timeout_ms: { type: "integer", default: 8000 },
          allow_ddl_dml: { type: "boolean", default: false } // must be false; server enforces
        },
        required: ["connection_id", "dialect", "query"]
      }
      // returns: { rows:[{}], columns:[{name,type}], rowCount, elapsedMs }
    },
    {
      name: "summarize",
      description: "Summarize a result for a direct answer.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          result: { type: "object" } // { rows, columns, rowCount } - optional
        },
        required: ["question"]
      }
      // returns: { text: "23 new users today", notes?: string }
    },
    {
      name: "suggest_chart",
      description: "Suggest a chart spec from the query/result.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          dialect: { type: "string" },
          query: { type: "string" },
          result_shape: { type: "object" } // columns/types & sample row
        },
        required: ["question", "result_shape"]
      }
      // returns: { type:"kpi|line|bar|area|pie", title, encodings:{}, options:{} }
    },
    {
      name: "create_dataset",
      description: "Persist an SQL query as a Chartbrew dataset (before making a chart).",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Project ID where the dataset will be created" },
          connection_id: { type: "string", description: "Connection ID to use for data fetching (must be MySQL, PostgreSQL, or MongoDB)" },
          name: { type: "string", description: "Dataset name/legend" },
          xAxis: { type: "string", description: "X axis field using traversal syntax (use 'root[].field_name' for array results, e.g. 'root[].month_start')" },
          yAxis: { type: "string", description: "Y axis field using traversal syntax (use 'root[].field_name' for array results, e.g. 'root[].count')" },
          yAxisOperation: {
            type: "string",
            enum: ["none", "sum", "avg", "min", "max", "count"],
            default: "none",
            description: "Y axis aggregation operation"
          },
          dateField: { type: "string", description: "Date field for filtering" },
          dateFormat: { type: "string", description: "Date format (e.g. YYYY-MM-DD)" },
          query: { type: "string", description: "SQL query for the dataset" },
          conditions: { type: "array", items: { type: "object" }, description: "Database filtering conditions" },
          configuration: { type: "object", description: "Dialect-specific settings" },
          variables: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "Parameterized query variables"
          },
          transform: { type: "object", description: "Data transformation rules" }
        },
        required: ["connection_id", "name", "xAxis", "yAxis", "query"]
      }
      // returns: { dataset_id, data_request_id, name, dataset_url }
    },
    {
      name: "create_chart",
      description: "Create a chart and place it on a visible project/dashboard. CRITICAL: ONLY use this when the user EXPLICITLY requests placing a chart in a specific dashboard (e.g., 'add to Sales Dashboard', 'place in Marketing dashboard'). DEFAULT to create_temporary_chart instead. Use the EXACT project_id specified by the user.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "The EXACT project/dashboard ID specified by the user where the chart will be placed. Use this exact ID - never create charts in other projects for testing or validation." },
          dataset_id: { type: "string" },
          name: { type: "string", description: "Chart name/title" },
          legend: { type: "string", description: "Short legend text for data points (max 20-30 chars, appears on hover)" },
          type: { type: "string", enum: ["line", "bar", "pie", "doughnut", "radar", "polar", "table", "kpi", "avg", "gauge", "matrix"] },
          subType: { type: "string", description: "Chart subtype (e.g. 'AddTimeseries' for KPI totals)" },
          displayLegend: { type: "boolean", description: "Show chart legend" },
          pointRadius: { type: "integer", description: "Point radius (0 to hide, >0 to show)" },
          dataLabels: { type: "boolean", description: "Show values on data points" },
          includeZeros: { type: "boolean", description: "Include zero values" },
          timeInterval: { type: "string", enum: ["second", "minute", "hour", "day", "week", "month", "year"] },
          stacked: { type: "boolean", description: "Stack bars (bar charts only)" },
          horizontal: { type: "boolean", description: "Horizontal bars (bar charts only)" },
          xLabelTicks: { type: "string", enum: ["default", "half", "third", "fourth", "showAll"], description: "How many ticks to display on the x-axis" },
          showGrowth: { type: "boolean", description: "Show percentage growth" },
          invertGrowth: { type: "boolean", description: "Invert growth calculation" },
          mode: { type: "string", enum: ["chart", "kpichart"], description: "Chart mode - kpichart shows a KPI on top of the chart" },
          maxValue: { type: "integer", description: "Cap maximum value" },
          minValue: { type: "integer", description: "Cap minimum value" },
          ranges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                min: { type: "number" },
                max: { type: "number" },
                label: { type: "string" },
                color: { type: "string" }
              }
            },
            description: "Gauge ranges [{min, max, label, color}]"
          },
          spec: { type: "object", description: "Alternative: Chart specification object (backward compatibility)" }
        },
        required: ["project_id", "dataset_id", "name"]
      }
      // returns: { chart_id, name, type, project_id, dashboard_url, chart_url }
    },
    {
      name: "update_dataset",
      description: "Update an existing dataset and its associated data request with new SQL query, mappings, or configuration.",
      parameters: {
        type: "object",
        properties: {
          dataset_id: { type: "string", description: "The ID of the dataset to update" },
          name: { type: "string", description: "New dataset name/legend" },
          xAxis: { type: "string", description: "X axis field using traversal syntax (use 'root[].field_name' for array results)" },
          yAxis: { type: "string", description: "Y axis field using traversal syntax (use 'root[].field_name' for array results)" },
          yAxisOperation: {
            type: "string",
            enum: ["none", "sum", "avg", "min", "max", "count"],
            description: "Y axis aggregation operation"
          },
          dateField: { type: "string", description: "Date field for filtering" },
          dateFormat: { type: "string", description: "Date format (e.g. YYYY-MM-DD)" },
          query: { type: "string", description: "New SQL query for the dataset" },
          conditions: { type: "array", items: { type: "object" }, description: "Database filtering conditions" },
          configuration: { type: "object", description: "Dialect-specific settings" },
          variables: { type: "array", items: { type: "string" }, description: "Query variables/parameters" },
          transform: { type: "object", description: "Data transformation rules" }
        },
        required: ["dataset_id"]
      }
      // returns: { dataset_id, data_request_id, name, dataset_url, updated_fields }
    },
    {
      name: "update_chart",
      description: "Update an existing chart with new properties, styling, or dataset configuration.",
      parameters: {
        type: "object",
        properties: {
          chart_id: { type: "string", description: "The ID of the chart to update" },
          dataset_id: { type: "string", description: "New dataset ID (if changing the dataset)" },
          name: { type: "string", description: "New chart name/title" },
          legend: { type: "string", description: "Short legend text for data points (max 20-30 chars, appears on hover)" },
          type: { type: "string", enum: ["line", "bar", "pie", "doughnut", "radar", "polar", "table", "kpi", "avg", "gauge", "matrix"], description: "Chart type" },
          subType: { type: "string", description: "Chart subtype (e.g. 'AddTimeseries' for KPI totals)" },
          displayLegend: { type: "boolean", description: "Show chart legend" },
          pointRadius: { type: "integer", description: "Point radius (0 to hide, >0 to show)" },
          dataLabels: { type: "boolean", description: "Show values on data points" },
          includeZeros: { type: "boolean", description: "Include zero values" },
          timeInterval: { type: "string", enum: ["second", "minute", "hour", "day", "week", "month", "year"], description: "Time interval for time-based charts" },
          stacked: { type: "boolean", description: "Stack bars (bar charts only)" },
          horizontal: { type: "boolean", description: "Horizontal bars (bar charts only)" },
          xLabelTicks: { type: "string", enum: ["default", "half", "third", "fourth", "showAll"], description: "How many ticks to display on the x-axis" },
          showGrowth: { type: "boolean", description: "Show percentage growth" },
          invertGrowth: { type: "boolean", description: "Invert growth calculation" },
          mode: { type: "string", enum: ["chart", "kpichart"], description: "Chart mode - kpichart shows a KPI on top of the chart" },
          maxValue: { type: "integer", description: "Cap maximum value" },
          minValue: { type: "integer", description: "Cap minimum value" },
          ranges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                min: { type: "number" },
                max: { type: "number" },
                label: { type: "string" },
                color: { type: "string" }
              }
            },
            description: "Gauge ranges [{min, max, label, color}]"
          },
          datasetColor: { type: "string", description: "Color for the dataset in this chart" },
          fillColor: { type: "string", description: "Fill color for area charts" },
          fill: { type: "boolean", description: "Fill area under line" },
          multiFill: { type: "boolean", description: "Multi-color fill" },
          excludedFields: { type: "array", items: { type: "string" }, description: "Fields to exclude from display" },
          sort: { type: "object", description: "Sort configuration" },
          columnsOrder: { type: "array", items: { type: "string" }, description: "Custom column order" },
          maxRecords: { type: "integer", description: "Maximum records to display" },
          goal: { type: "object", description: "Goal/target configuration" },
          spec: { type: "object", description: "Alternative: Chart specification object (backward compatibility)" }
        },
        required: ["chart_id"]
      }
      // returns: { chart_id, name, type, project_id, dashboard_url, chart_url, updated_fields }
    },
    {
      name: "create_temporary_chart",
      description: "DEFAULT tool for creating charts. Create a temporary preview chart that shows the data visually without placing it in a visible dashboard. Use this for ALL chart creation requests UNLESS the user explicitly says 'add to [dashboard]' or 'place in [dashboard]'. The chart will be shown as a preview and can later be moved to a dashboard using move_chart_to_dashboard if the user requests it.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string", description: "Connection ID to use for data fetching (must be MySQL, PostgreSQL, or MongoDB)" },
          name: { type: "string", description: "Chart name/title" },
          legend: { type: "string", description: "Short legend text for data points (max 20-30 chars, appears on hover)" },
          type: { type: "string", enum: ["line", "bar", "pie", "doughnut", "radar", "polar", "table", "kpi", "avg", "gauge", "matrix"] },
          subType: { type: "string", description: "Chart subtype (e.g. 'AddTimeseries' for KPI totals)" },
          displayLegend: { type: "boolean", description: "Show chart legend" },
          pointRadius: { type: "integer", description: "Point radius (0 to hide, >0 to show)" },
          dataLabels: { type: "boolean", description: "Show values on data points" },
          includeZeros: { type: "boolean", description: "Include zero values" },
          timeInterval: { type: "string", enum: ["second", "minute", "hour", "day", "week", "month", "year"] },
          stacked: { type: "boolean", description: "Stack bars (bar charts only)" },
          horizontal: { type: "boolean", description: "Horizontal bars (bar charts only)" },
          xLabelTicks: { type: "string", enum: ["default", "half", "third", "fourth", "showAll"], description: "How many ticks to display on the x-axis" },
          showGrowth: { type: "boolean", description: "Show percentage growth" },
          invertGrowth: { type: "boolean", description: "Invert growth calculation" },
          mode: { type: "string", enum: ["chart", "kpichart"], description: "Chart mode - kpichart shows a KPI on top of the chart" },
          maxValue: { type: "integer", description: "Cap maximum value" },
          minValue: { type: "integer", description: "Cap minimum value" },
          ranges: {
            type: "array",
            items: {
              type: "object",
              properties: {
                min: { type: "number" },
                max: { type: "number" },
                label: { type: "string" },
                color: { type: "string" }
              }
            },
            description: "Gauge ranges [{min, max, label, color}]"
          },
          xAxis: { type: "string", description: "X axis field using traversal syntax (use 'root[].field_name' for array results)" },
          yAxis: { type: "string", description: "Y axis field using traversal syntax (use 'root[].field_name' for array results)" },
          yAxisOperation: {
            type: "string",
            enum: ["none", "sum", "avg", "min", "max", "count"],
            default: "none",
            description: "Y axis aggregation operation"
          },
          dateField: { type: "string", description: "Date field for filtering" },
          dateFormat: { type: "string", description: "Date format (e.g. YYYY-MM-DD)" },
          query: { type: "string", description: "SQL query for the dataset" },
          conditions: { type: "array", items: { type: "object" }, description: "Database filtering conditions" },
          configuration: { type: "object", description: "Dialect-specific settings" },
          variables: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "Query variables/parameters"
          },
          transform: { type: "object", description: "Data transformation rules" },
          spec: { type: "object", description: "Alternative: Chart specification object (backward compatibility)" }
        },
        required: ["connection_id", "name", "xAxis", "yAxis", "query"]
      }
      // returns: {
      //   chart_id, dataset_id, data_request_id, name, type,
      //   is_temporary: true, ghost_project_id
      // }
    },
    {
      name: "move_chart_to_dashboard",
      description: "Move a temporary chart from the ghost project to a real dashboard/project. Use this after creating a temporary chart when the user confirms they want to add it to a specific dashboard. The chart's layout will be automatically recalculated for the new dashboard.",
      parameters: {
        type: "object",
        properties: {
          chart_id: { type: "string", description: "The ID of the chart to move (from create_temporary_chart)" },
          target_project_id: { type: "string", description: "The project/dashboard ID where the chart should be placed" }
        },
        required: ["chart_id", "target_project_id"]
      }
      // returns: { chart_id, previous_project_id, new_project_id, dashboard_url, chart_url }
    },
    {
      name: "disambiguate",
      description: "Ask the user to choose among options when planning couldn’t decide.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          options: {
            type: "array",
            items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"] }
          }
        },
        required: ["prompt", "options"]
      }
      // returns: { chosen: { label, value } }
    }
  ];
}

async function callTool(name, payload) {
  try {
    switch (name) {
      case "list_connections":
        return listConnections(payload);
      case "get_schema":
        return getSchema(payload);
      case "generate_query":
        return generateQuery(payload);
      case "validate_query":
        return validateQuery(payload);
      case "run_query":
        return runQuery(payload);
      case "summarize":
        return summarize(payload);
      case "suggest_chart":
        return suggestChart(payload);
      case "create_dataset":
        return createDataset(payload);
      case "create_chart":
        return createChart(payload);
      case "update_dataset":
        return updateDataset(payload);
      case "update_chart":
        return updateChart(payload);
      case "create_temporary_chart":
        return createTemporaryChart(payload);
      case "move_chart_to_dashboard":
        return moveChartToDashboard(payload);
      case "disambiguate":
        return disambiguate(payload);
      default:
        throw new Error(`Tool ${name} not found`);
    }
  } catch (error) {
    throw new Error(`Tool ${name} execution failed: ${error.message}`);
  }
}

function buildSystemPrompt(semanticLayer, conversation = null) {
  const { connections, projects, chartCatalog } = semanticLayer;

  const isNewConversation = !conversation || conversation.message_count === 0;

  const conversationContext = isNewConversation
    ? `\n## New Conversation
This is the start of a new conversation. Introduce yourself and be helpful.

IMPORTANT: For your FIRST response in this new conversation, start with a markdown header (like # Title) that describes the conversation. This will be used as the conversation title.

The title should be actionable and descriptive based on the user's question.`
    : `\n## Current Conversation
This is a continuing conversation. Be aware of previous interactions and maintain context.`;

  return `You are an AI assistant for Chartbrew, a data visualization platform. Your role is to help users query their data and create charts.${conversationContext}

## Available Connections
${connections.filter((c) => ["mysql", "postgres", "mongodb"].includes(c.type)).map((c) => `- ${c.name} (${c.type}${c.subType ? `/${c.subType}` : ""}) [ID: ${c.id}]`).join("\n")}

Note: Currently only the following database connections are supported:
- MySQL: Standard MySQL and Amazon RDS MySQL
- PostgreSQL: Standard PostgreSQL, TimescaleDB, Supabase, and Amazon RDS PostgreSQL
- MongoDB: Standard MongoDB

API connections and other sources will be available in future updates.

## Available Projects
${projects.map((p) => `- ${p.name} [ID: ${p.id}] - ${p.Charts?.length || 0} charts`).join("\n")}

## Chart Types Available
${chartCatalog.map((catalog) => Object.entries(catalog).map(([type, info]) => `- ${type}: ${info.description}`).join("\n")).join("\n")}

## How Chartbrew Works
1. **Connections**: Store database credentials and schemas. Currently supported:
   - **MySQL connections**: SQL databases with tables/columns
   - **PostgreSQL connections**: SQL databases with tables/columns
   - **MongoDB connections**: NoSQL databases with collections/documents
   - *API connections and other sources will be available in future updates*
2. **DataRequests**: Define how to fetch data using SQL queries
3. **Datasets**: Process and transform data from DataRequests for visualization
4. **Charts**: Visual representations of Datasets, placed in Projects (dashboards)
5. **ChartDatasetConfigs**: Link Charts to Datasets with specific configurations

${ENTITY_CREATION_RULES}

## Your Capabilities
- List and identify appropriate database connections (MySQL, PostgreSQL, MongoDB only)
- Retrieve database schemas with tables, columns, and sample data
- Generate SQL queries from natural language for supported databases
- Execute database queries and summarize results
- Suggest appropriate chart types for data
- Create datasets and charts in projects
- Create temporary charts when no project is specified, then move them to dashboards upon user confirmation
- Inform users when they request unsupported data sources (APIs, etc.) that these will be available in future updates
- Only suggest actions that correspond to these tools - no exports, sharing features, or other unimplemented functionality

## Core Principle: Take Initiative
**Be proactive, not reactive.** Your default mode should be to act, not ask.

- **Infer context automatically**: For connections and data sources, use context from the conversation. If only one connection exists or is obvious from context, use it automatically.
- **Use obvious connections**: If only one connection exists, or the connection is clear from context (e.g., "my sales database"), use it automatically. Only ask when multiple ambiguous options exist.
- **Create charts proactively**: After answering a data question, automatically create a TEMPORARY preview chart. Don't ask "would you like me to create a chart?" - just create it. This gives users a visual preview and control over dashboard placement.
- **Remember**: Temporary charts give users control. They can see the visualization immediately and decide where to save it. It's better to show a preview than to pollute their dashboards with unwanted charts.
- **Only ask questions when**: Context is truly ambiguous, multiple valid options exist with no clear preference, or you need clarification on user intent.

## Limitations
**Cannot generate or create data.** If asked to generate fake data, manually input data, add unsupported sources (Firebase, APIs), or create databases, respond tersely: "I can't generate data. Chartbrew visualizes data from connected databases. Connect MySQL, PostgreSQL, or MongoDB via the Connections page."

## Workflow Guidelines
1. When a user asks a data question:
   - If they request data generation, fake data, manual input, or unsupported sources: Use the Limitations response above. Do not proceed.
   - Check if they have supported database connections (MySQL, PostgreSQL, MongoDB)
   - If they request unsupported sources (APIs, Firebase, etc.): Briefly state only MySQL, PostgreSQL, and MongoDB are supported. API/other sources coming soon.
   - For supported database connections:
     * Call get_schema to get database schema information
     * Call generate_query with the schema to generate SQL queries
     * Call run_query to execute the SQL and get results
     * Summarize the results
     * **DEFAULT: Always create a temporary preview chart to show the results visually**

2. When creating charts - CRITICAL CHART PLACEMENT RULES:
   
   **🚨 IMPORTANT: Temporary charts are the DEFAULT. Only place charts in visible dashboards when explicitly requested by the user.**
   
   **Deciding between create_chart and create_temporary_chart:**
   - **DEFAULT: ALWAYS use create_temporary_chart** unless the user explicitly requests dashboard placement
   - **Use create_temporary_chart when**:
     * User says: "create a chart showing X"
     * User says: "visualize this data"
     * User says: "show me a graph of Y"
     * User says: "make a chart"
     * **ANY chart creation request WITHOUT explicit dashboard/project mention**
   
   - **ONLY use create_chart when user EXPLICITLY requests dashboard placement**:
     * User says: "create a chart in my Sales Dashboard"
     * User says: "add this to the Marketing dashboard"
     * User says: "place this chart on [Dashboard Name]"
     * User says: "save this chart to [Dashboard Name]"
     * **Must include BOTH: (1) chart creation intent AND (2) explicit dashboard/project name**
   
   **Temporary chart workflow:**
   - Create the temporary preview chart automatically
   - Show the chart to the user
   - After showing the chart, offer to add it to a dashboard: "Would you like to add this chart to a dashboard?"
   - If user says yes and specifies a dashboard, use move_chart_to_dashboard
   - The layout will be automatically recalculated when moving
   
   **Critical rules to prevent unwanted dashboard pollution:**
   - **NEVER assume dashboard placement from context or conversation history**
   - **NEVER place charts in dashboards just because a dashboard was mentioned earlier**
   - **NEVER place charts in dashboards "proactively" or "to be helpful"**
   - **ALWAYS default to temporary charts unless user explicitly says "add to [dashboard]" or "place in [dashboard]"**
   - **Users have full control** - they decide when and where charts are saved
   
   **General chart creation rules:**
   - **CRITICAL: NEVER create validation, test, or trial charts.** Create the chart exactly once.
   - **CRITICAL: One attempt only.** Do not create multiple charts to "test" or "validate".
   - If only one connection exists or the connection is obvious from context (e.g., user mentions "my database"), use it automatically
   - Suggest the most appropriate chart type based on the data automatically
   - Consider: KPI for single values, line for time series, bar for comparisons, pie for proportions
   - When creating charts, provide a descriptive name that reflects the data being visualized (e.g., "Monthly Sales Trends" instead of "AI Generated Chart")
   - Keep responses conversational and focused on insights/results rather than listing technical metadata
   - When answering data questions, give the direct answer first, then show the chart
   - **REMEMBER: Temporary charts give users control over what gets saved to their dashboards. Users can always edit charts and datasets afterwards**

3. Best practices:
   - **CRITICAL: Default to temporary charts.** Only place in dashboards when explicitly requested.
   - **CRITICAL: Respect user instructions exactly.** If the user specifies a dashboard, use that exact dashboard. Never create charts in other dashboards for any reason.
   - **CRITICAL: No validation or test runs.** Create charts once, as temporary previews by default.
   - Infer connection choice from context when obvious (prefer previously used connections)
   - Only confirm connection choice if multiple databases contain similar data AND the user's intent is ambiguous
   - Ask before making permanent changes (updating existing datasets/charts)
   - Only suggest actions and features that are actually available through your tools
   - Use clear, non-technical language when summarizing data
   - In continuing conversations, reference previous work and build upon it (connection preferences, chart types used)
   - For data generation requests: Be terse. Use the Limitations response template. Don't explain why or offer alternatives.

## Response Formatting
Format all responses using markdown to improve readability:
- Use **bold** for important numbers, key findings, and emphasis
- Use \`code blocks\` only for SQL queries when relevant - avoid technical jargon otherwise
- Don't overdo bullet points and numbered lists - use them sparingly
- Use headers (###) to organize content - Result, notes, next steps, etc
- Highlight key metrics and results prominently
- Use tables sparingly and only when necessary for clarity - avoid dumping raw query results
- Be terse and to the point - avoid verbose metadata dumps (IDs, URLs, connection details, database names, table names, query execution times)
- Focus on business insights and actionable information rather than technical implementation details
- Keep responses conversational and user-friendly, avoiding technical explanations unless specifically asked

## Quick-Reply Suggestions (User Response Shortcuts)
When you ask the user a question or offer choices, emit a structured suggestions block that the UI will parse into clickable quick replies.

**CRITICAL**: These are NOT tool calls. They are simulated user responses that continue the conversation naturally.

**FORMATTING REQUIREMENT**: You MUST output the cb-actions block using EXACTLY this markdown code fence format:

\`\`\`cb-actions
{
  "version": 1,
  "suggestions": [
    {
      "id": "unique_short_id",
      "label": "Natural user response text",
      "action": "reply"
    }
  ]
}
\`\`\`

The block must start with three backticks, "cb-actions", newline, then the JSON, then newline, then three backticks. NO variations allowed.

When to emit:
- When you ask the user a question with clear answer options
- When offering multiple paths forward (e.g., "total across all projects" vs "breakdown by project")
- When the user might want to explore related options

**How it works:**
1. You ask: "Do you want the total across all projects or a breakdown by project?"
2. You emit quick replies: ["Get total across all projects", "Get breakdown by project", "List other data sources"]
3. User clicks a quick reply
4. The UI sends that text back to you as if the user typed it
5. You respond to their choice naturally

Allowed action type: "reply" (this is the ONLY allowed action type)

Rules:
- Return 2-4 quick reply suggestions
- Make them sound like natural user responses
- Keep labels conversational and clear (e.g., "Get total across all projects" not "run_query")
- NO technical parameters, NO tool names, NO connection IDs in the labels
- Think: "What would the user naturally say in response to my question?"

Output the block exactly as shown—no extra prose before/after.

Good examples

When asking about data scope:

\`\`\`cb-actions
{
  "version": 1,
  "suggestions": [
    {
      "id": "total_all",
      "label": "Get total across all projects",
      "action": "reply"
    },
    {
      "id": "breakdown_project",
      "label": "Get breakdown by project",
      "action": "reply"
    },
    {
      "id": "other_sources",
      "label": "List other data sources",
      "action": "reply"
    }
  ]
}
\`\`\`

When offering chart type choices:

\`\`\`cb-actions
{
  "version": 1,
  "suggestions": [
    {
      "id": "create_line",
      "label": "Create a line chart",
      "action": "reply"
    },
    {
      "id": "create_bar",
      "label": "Create a bar chart",
      "action": "reply"
    },
    {
      "id": "create_kpi",
      "label": "Create a KPI card",
      "action": "reply"
    },
    {
      "id": "show_table",
      "label": "Just show me the data",
      "action": "reply"
    }
  ]
}
\`\`\`

When asking about filtering:

\`\`\`cb-actions
{
  "version": 1,
  "suggestions": [
    {
      "id": "published_only",
      "label": "Count only published charts",
      "action": "reply"
    },
    {
      "id": "include_drafts",
      "label": "Include draft charts",
      "action": "reply"
    },
    {
      "id": "by_type",
      "label": "Break down by chart type",
      "action": "reply"
    }
  ]
}
\`\`\`

Critical: Never prefix with "Suggestions:" text. Emit only the fenced cb-actions block (plus your normal prose answer above it).

## Important Notes
- You can only create read-only queries (no INSERT, UPDATE, DELETE, DROP)
- Always respect the user's data privacy and security
- **CRITICAL: Default to temporary charts (create_temporary_chart). ONLY use create_chart when user explicitly says "add to [dashboard]" or "place in [dashboard]". When placing in dashboards, use the EXACT project_id specified by the user.**
- **CRITICAL: Never pollute visible dashboards with charts unless explicitly requested. Temporary charts give users control over what gets saved.**
- **TAKE INITIATIVE: Infer connection context from conversation history. Only use the disambiguate tool when context is truly ambiguous. Default to action, not questions.**
- **FORMATTING REMINDER**: When using cb-actions, ALWAYS use the exact fenced code block format with three backticks. Never output cb-actions without the proper markdown code fence markers.

At the end of every answer, STOP and check:
- If you included a cb-actions block, check that it is valid JSON and that the action type is "reply".
- If you asked a question or offered choices, add quick replies now so the user can respond with one click.
- **FINAL CHECK**: If you used cb-actions, verify it has proper markdown code fence formatting - if not, fix it immediately.
`;
}

/**
 * Sanitizes conversation history to ensure OpenAI API compliance.
 * Removes any assistant messages with tool_calls that don't have complete tool responses.
 * Also removes orphaned tool responses that don't match any tool_call_id.
 * OpenAI requires that every tool_call_id has a corresponding tool response message,
 * and every tool response must reference a valid tool_call_id from the previous assistant message.
 */
function sanitizeConversationHistory(history) {
  if (!Array.isArray(history) || history.length === 0) {
    return history;
  }

  const sanitized = [];
  let i = 0;

  while (i < history.length) {
    const message = history[i];

    // Check if this is an assistant message with tool_calls
    if (message.role === "assistant" && message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      // Collect all tool_call_ids from this assistant message
      const toolCallIds = new Set(message.tool_calls.map((tc) => tc.id));

      // Look ahead to find tool response messages
      const toolResponses = [];
      let j = i + 1;
      while (j < history.length && history[j].role === "tool") {
        toolResponses.push(history[j]);
        j++;
      }

      // Filter tool responses to only include those with valid tool_call_ids
      const validToolResponses = toolResponses.filter((tr) => {
        const callId = tr.tool_call_id;
        return callId && toolCallIds.has(callId);
      });

      // Check for orphaned tool responses (responses without matching tool_call_ids)
      const orphanedResponses = toolResponses.filter((tr) => {
        const callId = tr.tool_call_id;
        return callId && !toolCallIds.has(callId);
      });

      if (orphanedResponses.length > 0) {
        const orphanedIds = orphanedResponses.map((tr) => tr.tool_call_id).join(", ");
        // eslint-disable-next-line no-console
        console.warn(`Removing orphaned tool responses with tool_call_ids: ${orphanedIds}`);
      }

      // Check if all tool_call_ids have valid responses
      const respondedIds = new Set(validToolResponses.map((tr) => tr.tool_call_id).filter(Boolean));
      const allResponded = toolCallIds.size > 0
        && Array.from(toolCallIds).every((id) => respondedIds.has(id));

      if (allResponded && validToolResponses.length === toolResponses.length) {
        // All tool calls have valid responses - include assistant message and tool responses
        sanitized.push(message);
        sanitized.push(...validToolResponses);
        i = j; // Skip past all the tool responses
      } else {
        // Incomplete or invalid tool calls - remove the assistant message and tool responses
        // This prevents OpenAI API errors
        const missingIds = Array.from(toolCallIds)
          .filter((id) => !respondedIds.has(id))
          .join(", ");
        // eslint-disable-next-line no-console
        console.warn(`Removing incomplete assistant message with tool_calls. Missing responses for tool_call_ids: ${missingIds}`);
        i = j; // Skip past the incomplete sequence
      }
    } else if (message.role === "tool") {
      // Orphaned tool response (no preceding assistant message with tool_calls)
      // Remove it to prevent OpenAI API errors
      // eslint-disable-next-line no-console
      console.warn(`Removing orphaned tool response with tool_call_id: ${message.tool_call_id || "unknown"}`);
      i++;
    } else {
      // Regular message - include it
      sanitized.push(message);
      i++;
    }
  }

  return sanitized;
}

async function buildSemanticLayer(teamId) {
  const team = await db.Team.findByPk(teamId);
  if (!team) {
    throw new Error("Team not found");
  }

  const connections = await db.Connection.findAll({
    where: {
      team_id: teamId,
    },
    attributes: ["id", "type", "subType", "name", "schema"],
  });

  const projects = await db.Project.findAll({
    where: {
      team_id: teamId,
      ghost: false,
    },
    attributes: ["id", "name"],
    include: [
      {
        model: db.Chart,
        attributes: ["id", "name", "type", "subType", "timeInterval", "stacked", "horizontal", "ranges"],
      },
    ],
  });

  const datasets = await db.Dataset.findAll({
    where: {
      team_id: teamId,
    },
    attributes: ["id", "legend", "query", "xAxis", "yAxis", "yAxisOperation", "dateFormat"],
    include: [{
      model: db.DataRequest,
      attributes: ["id", "connection_id", "query", "conditions", "configuration"]
    }]
  });

  const chartCatalog = [{
    "line": {
      description: "A line chart can be used to show trends over time, can be used as an area chart by setting the fillColor",
    },
    "bar": {
      description: "A bar chart can be used to compare values across categories, can be used as a stacked bar chart by setting the stacked property to true. Use fillColor for bar charts to make them more visually appealing.",
    },
    "pie": {
      description: "A pie chart can be used to show the proportion of each category in a total",
    },
    "doughnut": {
      description: "A doughnut chart can be used to show the proportion of each category in a total, similar to a pie chart but with a hole in the center",
    },
    "radar": {
      description: "A radar chart can be used to show the relative values of each category in a total",
    },
    "polar": {
      description: "A polar chart can be used to show the relative values of each category in a total, similar to a radar chart but with a polar axis",
    },
    "table": {
      description: "For tabular data",
    },
  }, {
    "kpi": {
      description: "A KPI chart can be used to show a single value. Important to note that the KPI chart shows the last data point from chartData, so if the data comes as an array you can set the subType to AddTimeseries to compound the data so that the last shows the total",
    },
    "avg": {
      description: "Similar to a KPI chart, but shows the average value of the data based on the number of data points",
    },
    "matrix": {
      description: "Currently only supported for time-based heatmaps with days of the week on the y axis and days on the x axis",
    },
    "gauge": {
      description: "A gauge chart can be used to show an indicator value within a predefined range, using the chart's ranges field",
      ranges: [{
        min: 0, max: 100, label: "Total", color: "#000000"
      }],
    },
    chartColors,
  }];

  const semanticLayer = {
    team,
    connections,
    projects,
    datasets,
    chartCatalog,
  };

  return semanticLayer;
}

async function orchestrate(
  teamId, question, conversationHistory = [], conversation = null, context = null, options = {}
) {
  // Extract optional tool progress callback
  const { toolProgressCallback } = options;
  if (!openaiClient) {
    throw new Error("OpenAI client is not initialized. Please check your environment variables.");
  }

  // Sanitize conversation history to ensure OpenAI API compliance
  // This removes any assistant messages with tool_calls that don't have complete tool responses
  const sanitizedHistory = sanitizeConversationHistory(conversationHistory);

  // Emit initial processing event
  if (conversation?.id) {
    emitProgressEvent(socketManager, conversation.id, "PROCESSING_START", { question });
  }

  const semanticLayer = await buildSemanticLayer(teamId);

  // Check if this is a capability question
  if (isCapabilityQuestion(question)) {
    // Generate capability response without AI calls
    const capabilityResponse = generateCapabilityResponse(semanticLayer);

    // Prepare messages for database recording
    const messages = [
      { role: "system", content: "System prompt for capability response" }, // Simplified for recording
      ...sanitizedHistory,
      { role: "user", content: question },
      { role: "assistant", content: capabilityResponse }
    ];

    // Emit completion event
    if (conversation?.id) {
      emitProgressEvent(socketManager, conversation.id, "PROCESSING_COMPLETE");
    }

    // Return with 0 token usage
    return {
      message: capabilityResponse,
      conversationHistory: messages,
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      usageRecords: [{
        model: openAiModel || "gpt-5-nano",
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        elapsed_ms: 0,
      }],
      iterations: 0,
    };
  }

  const systemPrompt = buildSystemPrompt(semanticLayer, conversation);

  // Prepare messages
  const messages = [
    { role: "system", content: systemPrompt },
    ...sanitizedHistory
  ];

  // Inject context as separate assistant message if provided
  if (context && Array.isArray(context) && context.length > 0) {
    const contextInfo = context.map((entity) => `${entity.label}`).join("\n");
    messages.push({
      role: "assistant",
      content: `CONTEXT:\n${contextInfo}`
    });
  }

  // Add user message
  messages.push({
    role: "user",
    content: question
  });

  // Get available tools in OpenAI format
  const toolDefinitions = await availableTools();
  const tools = toolDefinitions.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));

  // Track all usage records (one per API call)
  const usageRecords = [];
  // Track snapshots from chart creation/update tools
  const snapshots = [];

  // Initial API call
  const startTime1 = Date.now();
  let response = await openaiClient.chat.completions.create({
    model: openAiModel || "gpt-5-nano",
    messages,
    tools,
    tool_choice: "auto",
    reasoning_effort: "low",
    verbosity: "low",
  });
  const elapsedMs1 = Date.now() - startTime1;

  // Record first usage
  if (response.usage) {
    usageRecords.push({
      model: openAiModel || "gpt-5-nano",
      prompt_tokens: response.usage.prompt_tokens || 0,
      completion_tokens: response.usage.completion_tokens || 0,
      total_tokens: response.usage.total_tokens || 0,
      elapsed_ms: elapsedMs1,
    });
  }

  const updatedMessages = [...messages];
  let assistantMessage = response.choices[0].message;
  const maxIterations = 10; // Prevent infinite loops
  let iterations = 0;

  // Handle tool calls in a loop
  while (
    assistantMessage.tool_calls
    && assistantMessage.tool_calls.length > 0
    && iterations < maxIterations
  ) {
    iterations++;
    updatedMessages.push(assistantMessage);

    // Execute all tool calls in parallel
    // Emit progress for tool execution
    if (conversation?.id && assistantMessage.tool_calls.length > 0) {
      const toolNames = assistantMessage.tool_calls.map((tc) => tc.function.name);
      emitProgressEvent(socketManager, conversation.id, "EXECUTION_START", {
        tools: toolNames,
        message: `Executing ${toolNames.length} tool${toolNames.length > 1 ? "s" : ""}: ${toolNames.join(", ")}`
      });
    }

    // eslint-disable-next-line no-await-in-loop
    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (toolCall) => {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Inject team_id into tools that need it
        if (toolName === "create_dataset" || toolName === "run_query" || toolName === "create_chart" || toolName === "update_dataset" || toolName === "update_chart" || toolName === "create_temporary_chart" || toolName === "move_chart_to_dashboard") {
          toolArgs.team_id = teamId;
        }

        // Call progress callback before tool execution
        if (toolProgressCallback) {
          try {
            await toolProgressCallback(toolName, "start", toolArgs);
          } catch (callbackError) {
            // eslint-disable-next-line no-console
            console.error("Tool progress callback error:", callbackError);
          }
        }

        try {
          const result = await callTool(toolName, toolArgs);

          // Check if this tool result includes a snapshot
          if (result.snapshot) {
            // Convert relative snapshot path to full URL
            const snapshotUrl = `${process.env.VITE_APP_API_HOST}/${result.snapshot}`;

            snapshots.push({
              tool_name: toolName,
              chart_id: result.chart_id,
              snapshot: snapshotUrl,
              chart_name: result.name,
              chart_type: result.type
            });
          }

          // Check if this is a disambiguation request
          if (result.needs_user_input) {
            return {
              tool_call_id: toolCall.id,
              role: "tool",
              name: toolName,
              content: JSON.stringify({
                disambiguation_required: true,
                ...result
              })
            };
          }

          return {
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolName,
            content: JSON.stringify(result)
          };
        } catch (error) {
          // Call progress callback on error
          if (toolProgressCallback) {
            try {
              await toolProgressCallback(toolName, "error", { error: error.message });
            } catch (callbackError) {
              // eslint-disable-next-line no-console
              console.error("Tool progress callback error:", callbackError);
            }
          }

          return {
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolName,
            content: JSON.stringify({
              error: error.message,
              stack: error.stack
            })
          };
        }
      })
    );

    updatedMessages.push(...toolResults);

    // Check if any tool requires user input
    const needsDisambiguation = toolResults.some(
      (result) => {
        try {
          const parsed = JSON.parse(result.content);
          return parsed.disambiguation_required;
        } catch (e) {
          return false;
        }
      }
    );

    if (needsDisambiguation) {
      // Return to frontend for user input
      const disambiguationRequest = JSON.parse(
        toolResults.find((r) => {
          try {
            return JSON.parse(r.content).disambiguation_required;
          } catch (e) {
            return false;
          }
        }).content
      );

      return {
        needs_user_input: true,
        prompt: disambiguationRequest.prompt,
        options: disambiguationRequest.options,
        conversationHistory: updatedMessages,
      };
    }

    // Get next response from AI
    const startTime = Date.now();
    // eslint-disable-next-line no-await-in-loop
    response = await openaiClient.chat.completions.create({
      model: openAiModel || "gpt-5-nano",
      messages: updatedMessages,
      tools,
      tool_choice: "auto",
      reasoning_effort: "low",
      verbosity: "low",
    });
    const elapsedMs = Date.now() - startTime;

    // Record usage for this API call
    if (response.usage) {
      usageRecords.push({
        model: openAiModel || "gpt-5-nano",
        prompt_tokens: response.usage.prompt_tokens || 0,
        completion_tokens: response.usage.completion_tokens || 0,
        total_tokens: response.usage.total_tokens || 0,
        elapsed_ms: elapsedMs,
      });
    }

    assistantMessage = response.choices[0].message;
  }

  // Add final assistant message
  if (assistantMessage.content) {
    updatedMessages.push(assistantMessage);

    // Parse response for progress events and emit them
    if (conversation?.id) {
      const { events, cleanedResponse } = parseProgressEvents(assistantMessage.content);

      // Emit any parsed progress events
      events.forEach((event) => {
        socketManager.emitProgress(conversation.id, event.type, {
          message: event.message,
          parsed: true
        });
      });

      // Use cleaned response
      assistantMessage.content = cleanedResponse;
    }
  }

  // Emit completion event
  if (conversation?.id) {
    emitProgressEvent(socketManager, conversation.id, "PROCESSING_COMPLETE");
  }

  return {
    message: assistantMessage.content,
    conversationHistory: updatedMessages,
    usage: response.usage, // Last API call usage (backward compatibility)
    usageRecords, // All usage records for saving to AiUsage table
    iterations,
    snapshots, // Chart snapshots from tool results
  };
}

module.exports = {
  availableTools,
  orchestrate,
  buildSemanticLayer,
};
