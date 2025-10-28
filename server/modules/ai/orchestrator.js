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
const db = require("../../models/models");
const { generateSqlQuery } = require("./generateSqlQuery");
const ConnectionController = require("../../controllers/ConnectionController");
const socketManager = require("../socketManager");
const { emitProgressEvent, parseProgressEvents } = require("./responseParser");

const openAiKey = process.env.NODE_ENV === "production" ? process.env.CB_OPENAI_API_KEY : process.env.CB_OPENAI_API_KEY_DEV;
const openAiModel = process.env.NODE_ENV === "production" ? process.env.CB_OPENAI_MODEL : process.env.CB_OPENAI_MODEL_DEV;
let openaiClient;

if (openAiKey) {
  openaiClient = new OpenAI({
    apiKey: openAiKey,
  });
}

const connectionController = new ConnectionController();

async function listConnections(payload) {
  const { project_id } = payload; // scope could be used for filtering in the future

  const whereClause = {};

  // If project_id is provided, filter by connections used in that project
  if (project_id) {
    const datasets = await db.Dataset.findAll({
      attributes: ["connection_id"],
      include: [{
        model: db.DataRequest,
        attributes: ["connection_id"],
      }],
    });

    const connectionIds = new Set();
    datasets.forEach((ds) => {
      if (ds.connection_id) connectionIds.add(ds.connection_id);
      if (ds.DataRequests) {
        ds.DataRequests.forEach((dr) => {
          if (dr.connection_id) connectionIds.add(dr.connection_id);
        });
      }
    });

    if (connectionIds.size > 0) {
      whereClause.id = Array.from(connectionIds);
    }
  }

  const connections = await db.Connection.findAll({
    where: whereClause,
    attributes: ["id", "type", "subType", "name"],
    order: [["createdAt", "DESC"]],
  });

  return {
    connections: connections.map((c) => ({
      id: c.id,
      type: c.type,
      subType: c.subType,
      name: c.name,
    })),
  };
}

async function getSchema(payload) {
  const { connection_id, include_samples = true } = payload;
  // sample_rows_per_entity could be used when extracting samples in the future

  const connection = await db.Connection.findByPk(connection_id);
  if (!connection) {
    throw new Error("Connection not found");
  }

  // Return cached schema from the connection
  // TODO: Add sample data extraction from the schema
  return {
    dialect: connection.type,
    connection_id: connection.id,
    name: connection.name,
    entities: connection.schema || [],
    samples: include_samples ? {} : undefined,
  };
}

async function generateQuery(payload) {
  const {
    question, schema, preferred_dialect
  } = payload;
  // hints could be used for entity-level hints in the future

  if (!openaiClient) {
    return {
      status: "unsupported",
      message: "Query generation requires OpenAI to be configured",
    };
  }

  try {
    // Validate schema input (make optional for robustness)
    if (schema && typeof schema !== "object") {
      throw new Error("Schema must be a valid object if provided");
    }

    // If no schema provided, create a minimal one (AI should provide schema)
    const effectiveSchema = schema || {
      tables: ["User"],
      description: {
        User: {
          id: { type: "INT" },
          name: { type: "VARCHAR(255)" },
          email: { type: "VARCHAR(255)" },
          createdAt: { type: "DATETIME" }
        }
      }
    };

    // Use the existing SQL generation module
    const result = await generateSqlQuery(effectiveSchema, question, []);

    // Check if query generation succeeded
    if (!result || !result.query || result.query.trim() === "") {
      throw new Error("Query generation failed - no query returned");
    }

    // Basic validation: check for forbidden keywords (whole words only)
    const forbiddenKeywords = ["DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", "CREATE"];
    const upperQuery = result.query.toUpperCase();
    const hasForbiddenKeyword = forbiddenKeywords.some((keyword) => {
      // Use word boundaries to avoid false positives
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      return regex.test(upperQuery);
    });

    if (hasForbiddenKeyword) {
      return {
        status: "unsupported",
        message: "Generated query contains forbidden operations (only SELECT queries are allowed)",
        query: result.query,
      };
    }

    return {
      status: "ok",
      dialect: preferred_dialect,
      query: result.query,
      rationale: {
        message: "Query generated successfully",
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: `Query generation failed: ${error.message}`,
    };
  }
}

async function validateQuery() {
  // TODO: Implement dry-run validation using existing connection handlers
  // Should use the appropriate connection handler based on dialect
  // const { connection_id, dialect, query } = payload;

  return {
    valid: true,
    message: "Query validation not yet implemented",
    estimatedShape: {
      columns: [],
    },
  };
}

async function runQuery(payload) {
  const {
    connection_id, dialect, query, row_limit = 1000, timeout_ms = 8000, team_id
  } = payload;

  // Validate that the query is read-only (whole words only)
  const forbiddenKeywords = ["DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", "CREATE"];
  const upperQuery = query.toUpperCase();
  const hasForbiddenKeyword = forbiddenKeywords.some((keyword) => {
    // Use word boundaries to avoid false positives
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    return regex.test(upperQuery);
  });

  if (hasForbiddenKeyword) {
    throw new Error("Only read-only queries (SELECT) are allowed");
  }

  if (!team_id) {
    throw new Error("team_id is required to run queries");
  }

  try {
    const startTime = Date.now();

    // Add LIMIT clause if not present to respect row_limit
    let limitedQuery = query.trim();
    if (!upperQuery.includes("LIMIT") && (dialect === "postgres" || dialect === "mysql")) {
      limitedQuery = `${limitedQuery.replace(/;$/, "")} LIMIT ${row_limit}`;
    }

    // Create a temporary Dataset and DataRequest for proper database relationships
    const tempDataset = await db.Dataset.create({
      team_id,
      connection_id,
      legend: "AI Query Dataset",
      draft: true,
      query: limitedQuery,
    });

    const tempDataRequest = await db.DataRequest.create({
      dataset_id: tempDataset.id,
      connection_id,
      query: limitedQuery,
      method: "GET",
      useGlobalHeaders: true,
    });

    // Set as main data request
    await db.Dataset.update(
      { main_dr_id: tempDataRequest.id },
      { where: { id: tempDataset.id } }
    );

    let result;
    try {
      if (dialect === "postgres" || dialect === "mysql") {
        result = await connectionController.runMysqlOrPostgres(
          connection_id,
          tempDataRequest,
          false, // don't use cache
          limitedQuery
        );
      } else if (dialect === "mongodb") {
        result = await connectionController.runMongo(
          connection_id,
          tempDataRequest,
          false,
          limitedQuery
        );
      } else if (dialect === "clickhouse") {
        result = await connectionController.runClickhouse(
          connection_id,
          tempDataRequest,
          false,
          limitedQuery
        );
      } else {
        throw new Error(`Unsupported dialect: ${dialect}`);
      }

      const elapsedMs = Date.now() - startTime;

      // Check if query exceeded timeout (post-execution check)
      if (elapsedMs > timeout_ms) {
        throw new Error(`Query exceeded timeout of ${timeout_ms}ms`);
      }

      const data = result.responseData?.data || [];

      // Extract column names from first row
      const columns = data.length > 0
        ? Object.keys(data[0]).map((name) => ({ name, type: typeof data[0][name] }))
        : [];

      return {
        rows: data.slice(0, row_limit),
        columns,
        rowCount: data.length,
        elapsedMs,
      };
    } finally {
      // Clean up the temporary Dataset and DataRequest
      await db.DataRequest.destroy({
        where: { id: tempDataRequest.id }
      });

      await db.Dataset.destroy({
        where: { id: tempDataset.id }
      });

      // Also clean up any cache entries
      await db.DataRequestCache.destroy({
        where: { dr_id: tempDataRequest.id }
      });
    }
  } catch (error) {
    throw new Error(`Query execution failed: ${error.message}`);
  }
}

async function summarize(payload) {
  const { question, result } = payload;

  // If no result provided, return a generic message
  if (!result) {
    return {
      text: "Query executed successfully. Use run_query to get specific results for summarization.",
    };
  }

  if (!openaiClient) {
    return {
      text: `Found ${result.rowCount} results`,
    };
  }

  // Use AI to generate a natural language summary
  const prompt = `Based on the question "${question}" and the following query results, provide a concise summary:\n\nResults: ${JSON.stringify(result.rows.slice(0, 5))}\nTotal rows: ${result.rowCount}`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: openAiModel || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a data analyst. Provide concise summaries of query results." },
        { role: "user", content: prompt },
      ],
      max_tokens: 150,
    });

    return {
      text: response.choices[0].message.content,
    };
  } catch (error) {
    return {
      text: `Found ${result.rowCount} results`,
      notes: `AI summarization failed: ${error.message}`,
    };
  }
}

async function suggestChart(payload) {
  const {
    question, result_shape
  } = payload;
  // dialect and query could be used for context in the future

  if (!openaiClient) {
    return {
      type: "table",
      title: "Query Results",
      encodings: {},
      options: {},
    };
  }

  // Use AI to suggest appropriate chart type
  const prompt = `Based on the question "${question}" and result columns ${JSON.stringify(result_shape.columns)}, suggest the most appropriate Chartbrew chart type and configuration.
  
Available chart types: line, bar, pie, doughnut, radar, polar, table, kpi, avg, gauge.

Respond with JSON only: { "type": "...", "title": "...", "encodings": {}, "options": {} }`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: openAiModel || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });

    const suggestion = JSON.parse(response.choices[0].message.content);
    return suggestion;
  } catch (error) {
    return {
      type: "table",
      title: "Query Results",
      encodings: {},
      options: {},
      notes: `Chart suggestion failed: ${error.message}`,
    };
  }
}

async function createDataset(payload) {
  const {
    project_id, connection_id, name, query, variables = [], team_id
  } = payload;
  // dialect could be stored for reference in the future

  if (!team_id) {
    throw new Error("team_id is required to create a dataset");
  }

  try {
    // Create the dataset
    const dataset = await db.Dataset.create({
      team_id,
      project_ids: project_id ? [project_id] : [],
      connection_id,
      legend: name || "AI Generated Dataset",
      draft: false,
    });

    // Create the data request linked to this dataset
    const dataRequest = await db.DataRequest.create({
      dataset_id: dataset.id,
      connection_id,
      query,
      variables: variables || [],
      method: "GET",
      useGlobalHeaders: true,
    });

    // Set as main data request
    await db.Dataset.update(
      { main_dr_id: dataRequest.id },
      { where: { id: dataset.id } }
    );

    return {
      dataset_id: dataset.id,
      data_request_id: dataRequest.id,
      name: dataset.legend,
    };
  } catch (error) {
    throw new Error(`Dataset creation failed: ${error.message}`);
  }
}

async function createChart(payload) {
  const { project_id, dataset_id, spec } = payload;

  if (!project_id) {
    throw new Error("project_id is required to create a chart");
  }

  // Provide default chart spec if not provided
  const defaultSpec = {
    type: "line",
    title: "AI Generated Chart",
    timeInterval: "month",
    options: {}
  };

  const chartSpec = spec || defaultSpec;

  try {
    // Get the project to find the next dashboard order
    const existingCharts = await db.Chart.findAll({
      where: { project_id },
      attributes: ["dashboardOrder"],
      order: [["dashboardOrder", "DESC"]],
      limit: 1,
    });

    const nextOrder = existingCharts.length > 0
      ? (existingCharts[0].dashboardOrder || 0) + 1
      : 0;

    // Create the chart
    const chart = await db.Chart.create({
      project_id,
      name: chartSpec.title || "AI Generated Chart",
      type: chartSpec.type || "line",
      subType: chartSpec.subType,
      draft: false,
      dashboardOrder: nextOrder,
      chartSize: 2, // default size
      displayLegend: true,
      includeZeros: true,
      timeInterval: chartSpec.timeInterval || "day",
      stacked: chartSpec.options?.stacked || false,
      horizontal: chartSpec.options?.horizontal || false,
    });

    // Get the dataset to link it to the chart
    const dataset = await db.Dataset.findByPk(dataset_id);
    if (!dataset) {
      throw new Error("Dataset not found");
    }

    // Update dataset to link to this chart
    await db.Dataset.update(
      { chart_id: chart.id },
      { where: { id: dataset_id } }
    );

    // Create ChartDatasetConfig to link chart and dataset
    await db.ChartDatasetConfig.create({
      chart_id: chart.id,
      dataset_id,
      legend: chartSpec.title || dataset.legend,
      order: 1,
      datasetColor: chartSpec.options?.color || "#1f77b4",
    });

    return {
      chart_id: chart.id,
      name: chart.name,
      type: chart.type,
      project_id: chart.project_id,
    };
  } catch (error) {
    throw new Error(`Chart creation failed: ${error.message}`);
  }
}

async function disambiguate(payload) {
  const { prompt, options } = payload;

  // This is a special tool that pauses execution and asks the user to choose
  // The orchestrator should handle this by returning a disambiguation request
  return {
    needs_user_input: true,
    prompt,
    options,
  };
}

async function availableTools() {
  return [
    {
      name: "list_connections",
      description: "List connections available to the project/user context.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          scope: { type: "string", enum: ["all", "dashboard", "recent"], default: "all" }
        },
        required: ["project_id"]
      }
      // returns: { connections: [{ id, type:"postgres"|"mysql"|"mongodb"|..., name }] }
    },
    {
      name: "get_schema",
      description: "Get cached schema + small samples for a connection.",
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
      //   dialect,
      //   entities:[{ name, kind, columns:[{name,type}], stats?:{rowCount?} }],
      //   samples?:{ [entity]: [{}...] }
      // }
    },
    {
      name: "generate_query",
      description: "Plan and generate a read-only query from the question and schema.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          schema: { type: "object" }, // optional - will use default User table schema if not provided
          hints: { type: "object" }, // optional project-level entity hints
          preferred_dialect: { type: "string", enum: ["postgres", "mysql", "mssql", "mongodb", "sqlite"] }
        },
        required: ["question"]
      }
      // returns: {
      //  status: "ok"|"needs_disambiguation"|"unsupported",
      //  dialect, connection_id?, query, rationale:{table, cols, filters},
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
      description: "Execute a read-only query with guardrails.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          dialect: { type: "string" },
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
      description: "Persist the query as a Chartbrew dataset (before making a chart).",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          connection_id: { type: "string" },
          name: { type: "string" },
          dialect: { type: "string" },
          query: { type: "string" },
          variables: { type: "array", items: { type: "string" }, default: [] }
        },
        required: ["connection_id", "name", "dialect", "query"]
      }
      // returns: { dataset_id, data_request_id, name }
    },
    {
      name: "create_chart",
      description: "Create a chart and place it on a project/dashboard, bound to a dataset.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "The project/dashboard ID where the chart will be placed" },
          dataset_id: { type: "string" },
          spec: { type: "object", description: "Chart specification from suggest_chart including type, title, options (optional - defaults to line chart)" }
        },
        required: ["project_id", "dataset_id"]
      }
      // returns: { chart_id, name, type, project_id }
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

IMPORTANT: For your FIRST response in this new conversation, include a conversation title at the very beginning in this exact format:
[TITLE: Your concise title here (max 6 words)]

The title should be actionable and descriptive based on the user's question.`
    : `\n## Current Conversation
This is a continuing conversation. Be aware of previous interactions and maintain context.`;

  return `You are an AI assistant for Chartbrew, a data visualization platform. Your role is to help users query their data and create charts.${conversationContext}

## Available Connections
${connections.map((c) => `- ${c.name} (${c.type}${c.subType ? `/${c.subType}` : ""}) [ID: ${c.id}]`).join("\n")}

## Available Projects
${projects.map((p) => `- ${p.name} [ID: ${p.id}] - ${p.Charts?.length || 0} charts`).join("\n")}

## Chart Types Available
${chartCatalog.map((catalog) => Object.entries(catalog).map(([type, info]) => `- ${type}: ${info.description}`).join("\n")).join("\n")}

## How Chartbrew Works
1. **Connections**: Store database credentials and schemas. Users can have multiple connections (PostgreSQL, MySQL, MongoDB, etc.)
2. **DataRequests**: Define how to fetch data (SQL query, API endpoint, etc.) from a Connection
3. **Datasets**: Process and transform data from DataRequests for visualization
4. **Charts**: Visual representations of Datasets, placed in Projects (dashboards)
5. **ChartDatasetConfigs**: Link Charts to Datasets with specific configurations

## Your Capabilities
- List and identify appropriate connections based on user questions
- Retrieve database schemas from connections
- Generate SQL queries from natural language questions
- Execute queries and summarize results
- Suggest appropriate chart types for data
- Create datasets and charts in projects

## Workflow Guidelines
1. When a user asks a data question:
   - Identify which connection to use (ask if ambiguous)
   - Get the schema for that connection
   - Generate an appropriate query
   - Validate the query
   - Run the query
   - Summarize the results
   - Offer to create a chart

2. When creating charts:
   - Suggest the most appropriate chart type based on the data
   - Consider: KPI for single values, line for time series, bar for comparisons, pie for proportions
   - Ask user for confirmation before creating
   - Create the dataset first, then the chart

3. Best practices:
   - Always confirm connection choice if multiple databases contain similar data
   - Explain your reasoning for chart type suggestions
   - Ask before making permanent changes (creating datasets/charts)
   - Use clear, non-technical language when summarizing data
   - In continuing conversations, reference previous work and build upon it

## Important Notes
- You can only create read-only queries (no INSERT, UPDATE, DELETE, DROP)
- Always respect the user's data privacy and security
- If you're unsure about anything, ask the user for clarification using the disambiguate tool`;
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
      description: "A bar chart can be used to compare values across categories, can be used as a stacked bar chart by setting the stacked property to true",
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
    }
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

async function orchestrate(teamId, question, conversationHistory = [], conversation = null) {
  if (!openaiClient) {
    throw new Error("OpenAI client is not initialized. Please check your environment variables.");
  }

  // Emit initial processing event
  if (conversation?.id) {
    emitProgressEvent(socketManager, conversation.id, "PROCESSING_START", { question });
  }

  const semanticLayer = await buildSemanticLayer(teamId);
  const systemPrompt = buildSystemPrompt(semanticLayer, conversation);

  // Prepare messages
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: question }
  ];

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

  // Initial API call
  let response = await openaiClient.chat.completions.create({
    model: openAiModel || "gpt-4o-mini",
    messages,
    tools,
    tool_choice: "auto",
  });

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
        if (toolName === "create_dataset" || toolName === "run_query") {
          toolArgs.team_id = teamId;
        }

        try {
          const result = await callTool(toolName, toolArgs);

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
    // eslint-disable-next-line no-await-in-loop
    response = await openaiClient.chat.completions.create({
      model: openAiModel || "gpt-4o-mini",
      messages: updatedMessages,
      tools,
      tool_choice: "auto",
    });

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
    usage: response.usage,
    iterations,
  };
}

module.exports = {
  availableTools,
  orchestrate,
  buildSemanticLayer,
};
