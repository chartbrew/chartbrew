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
const { generateSqlQuery } = require("../generateSqlQuery");
const ConnectionController = require("../../../controllers/ConnectionController");
const ChartController = require("../../../controllers/ChartController");
const DatasetController = require("../../../controllers/DatasetController");
const socketManager = require("../../socketManager");
const { emitProgressEvent, parseProgressEvents } = require("./responseParser");
const { ENTITY_CREATION_RULES, SUPPORTED_CONNECTIONS, isConnectionSupported } = require("./entityCreationRules");
const { chartColors } = require("../../../charts/colors");
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

const connectionController = new ConnectionController();
const datasetController = new DatasetController();
const chartController = new ChartController();

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

  // Only support MySQL, PostgreSQL, and MongoDB connections for now
  const supportedTypes = Object.keys(SUPPORTED_CONNECTIONS);

  const connections = await db.Connection.findAll({
    where: {
      ...whereClause,
      type: supportedTypes
    },
    attributes: ["id", "type", "subType", "name"],
    order: [["createdAt", "DESC"]],
  });

  // Filter connections to only include supported subtypes
  const filteredConnections = connections.filter(
    (conn) => isConnectionSupported(conn.type, conn.subType)
  );

  return {
    connections: filteredConnections.map((c) => ({
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

  // Check if connection type and subtype are supported
  if (!isConnectionSupported(connection.type, connection.subType)) {
    throw new Error(`Connection type '${connection.type}'${connection.subType ? `/${connection.subType}` : ""} is not supported. Currently only MySQL, PostgreSQL, and MongoDB connections are supported. API connections and other sources will be available in future updates.`);
  }

  // For supported database connections, return schema
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
    // For database connections, use SQL generation
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

  if (!team_id) {
    throw new Error("team_id is required to run queries");
  }

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
    project_id, connection_id, name, team_id,
    xAxis, yAxis, yAxisOperation = "none", dateField, dateFormat,
    query, conditions = [], configuration = {}, variables = [], transform = null,
    variableBindings = []
  } = payload;

  if (!team_id) {
    throw new Error("team_id is required to create a dataset");
  }

  try {
    // Use the quick-create function to create dataset with data request in one go
    const dataset = await datasetController.createWithDataRequests({
      team_id,
      project_ids: project_id ? [project_id] : [],
      draft: false,
      legend: name || "AI Generated Dataset",
      xAxis,
      yAxis,
      yAxisOperation,
      dateField,
      dateFormat,
      conditions,
      variableBindings,
      dataRequests: [{
        connection_id,
        query,
        conditions: conditions || [],
        configuration: configuration || {},
        variables: variables || [],
        transform: transform || null
      }],
      main_dr_index: 0
    });

    // Extract data request ID from the returned dataset
    const dataRequestId = dataset.DataRequests && dataset.DataRequests.length > 0
      ? dataset.DataRequests[0].id
      : dataset.main_dr_id;

    return {
      dataset_id: dataset.id,
      data_request_id: dataRequestId,
      name: dataset.legend,
      dataset_url: `${clientUrl}/${team_id}/dataset/${dataset.id}`,
    };
  } catch (error) {
    throw new Error(`Dataset creation failed: ${error.message}`);
  }
}

async function createChart(payload) {
  const {
    project_id, dataset_id, spec, team_id,
    name, legend, type, subType, displayLegend, pointRadius,
    dataLabels, includeZeros, timeInterval, stacked, horizontal,
    showGrowth, invertGrowth, mode, maxValue, minValue, ranges
  } = payload;

  if (!project_id) {
    throw new Error("project_id is required to create a chart");
  }

  if (!name) {
    throw new Error("name is required to create a chart");
  }

  // Provide default chart spec if not provided
  const defaultSpec = {
    type: "line",
    title: "AI Generated Chart",
    timeInterval: "day",
    chartSize: 2,
    displayLegend: true,
    pointRadius: 0,
    dataLabels: false,
    includeZeros: true,
    stacked: false,
    horizontal: false,
    showGrowth: false,
    invertGrowth: false,
    mode: "chart",
    options: {}
  };

  const chartSpec = spec || defaultSpec;

  try {
    // Get the dataset to get its legend for default values
    const dataset = await db.Dataset.findByPk(dataset_id);
    if (!dataset) {
      throw new Error("Dataset not found");
    }

    // Use the quick-create function to create chart with chart dataset config in one go
    // Layout will be auto-calculated by the controller
    const chart = await chartController.createWithChartDatasetConfigs({
      project_id,
      name: name || chartSpec.title || "AI Generated Chart",
      type: type || chartSpec.type,
      subType: subType || chartSpec.subType,
      draft: false,
      // eslint-disable-next-line no-nested-ternary
      displayLegend: displayLegend !== undefined
        ? displayLegend
        : chartSpec.displayLegend !== undefined
          ? chartSpec.displayLegend
          : true,
      pointRadius: pointRadius || chartSpec.pointRadius || 0,
      dataLabels: dataLabels || chartSpec.dataLabels || false,
      // eslint-disable-next-line no-nested-ternary
      includeZeros: includeZeros !== undefined
        ? includeZeros
        : chartSpec.includeZeros !== undefined
          ? chartSpec.includeZeros
          : true,
      timeInterval: timeInterval || chartSpec.timeInterval || "day",
      stacked: stacked ?? chartSpec.stacked ?? chartSpec.options?.stacked ?? false,
      horizontal: horizontal ?? chartSpec.horizontal ?? chartSpec.options?.horizontal ?? false,
      showGrowth: showGrowth || chartSpec.showGrowth || false,
      invertGrowth: invertGrowth || chartSpec.invertGrowth || false,
      mode: mode || chartSpec.mode || "chart",
      maxValue: maxValue || chartSpec.maxValue,
      minValue: minValue || chartSpec.minValue,
      ranges: ranges || chartSpec.ranges,
      layout: chartSpec.layout, // Will be auto-calculated if not provided
      chartDatasetConfigs: [{
        dataset_id,
        formula: chartSpec.formula,
        datasetColor: chartSpec.datasetColor || chartSpec.options?.color || "#4285F4",
        fillColor: chartSpec.fillColor,
        fill: chartSpec.fill || false,
        multiFill: chartSpec.multiFill || false,
        legend: legend || chartSpec.title || dataset.legend,
        pointRadius: pointRadius || chartSpec.pointRadius || 0,
        excludedFields: chartSpec.excludedFields || [],
        sort: chartSpec.sort,
        columnsOrder: chartSpec.columnsOrder,
        order: 1,
        maxRecords: chartSpec.maxRecords,
        goal: chartSpec.goal,
        configuration: chartSpec.configuration || {}
      }]
    }, null); // No user for AI-created charts

    return {
      chart_id: chart.id,
      name: chart.name,
      type: chart.type,
      project_id: chart.project_id,
      dashboard_url: `${clientUrl}/${team_id}/${project_id}/dashboard`,
      chart_url: `${clientUrl}/${team_id}/${project_id}/chart/${chart.id}/edit`,
    };
  } catch (error) {
    throw new Error(`Chart creation failed: ${error.message}`);
  }
}

async function updateDataset(payload) {
  const {
    dataset_id, name, team_id,
    xAxis, yAxis, yAxisOperation, dateField, dateFormat,
    query, conditions, configuration, variables, transform
  } = payload;

  if (!dataset_id) {
    throw new Error("dataset_id is required to update a dataset");
  }

  if (!team_id) {
    throw new Error("team_id is required to update a dataset");
  }

  try {
    // Find the existing dataset
    const dataset = await db.Dataset.findByPk(dataset_id);
    if (!dataset) {
      throw new Error("Dataset not found");
    }

    // Verify team ownership
    if (dataset.team_id !== team_id) {
      throw new Error("Dataset does not belong to the specified team");
    }

    // Update dataset fields (only if provided)
    const datasetUpdates = {};
    if (name !== undefined) datasetUpdates.legend = name;
    if (xAxis !== undefined) datasetUpdates.xAxis = xAxis;
    if (yAxis !== undefined) datasetUpdates.yAxis = yAxis;
    if (yAxisOperation !== undefined) datasetUpdates.yAxisOperation = yAxisOperation;
    if (dateField !== undefined) datasetUpdates.dateField = dateField;
    if (dateFormat !== undefined) datasetUpdates.dateFormat = dateFormat;
    if (conditions !== undefined) datasetUpdates.conditions = conditions;

    if (Object.keys(datasetUpdates).length > 0) {
      await db.Dataset.update(datasetUpdates, { where: { id: dataset_id } });
    }

    // Find and update the main data request
    const dataRequest = await db.DataRequest.findByPk(dataset.main_dr_id);
    if (!dataRequest) {
      throw new Error("DataRequest not found for this dataset");
    }

    // Update data request fields (only if provided)
    const drUpdates = {};
    if (query !== undefined) drUpdates.query = query;
    if (conditions !== undefined) drUpdates.conditions = conditions;
    if (configuration !== undefined) drUpdates.configuration = configuration;
    if (variables !== undefined) drUpdates.variables = variables;
    if (transform !== undefined) drUpdates.transform = transform;

    if (Object.keys(drUpdates).length > 0) {
      await db.DataRequest.update(drUpdates, { where: { id: dataRequest.id } });
    }

    // Refresh the dataset to get updated values
    const updatedDataset = await db.Dataset.findByPk(dataset_id, {
      include: [{
        model: db.DataRequest,
        attributes: ["id", "query", "conditions", "configuration", "variables", "transform"]
      }]
    });

    return {
      dataset_id: updatedDataset.id,
      data_request_id: updatedDataset.main_dr_id,
      name: updatedDataset.legend,
      dataset_url: `${clientUrl}/${team_id}/dataset/${updatedDataset.id}`,
      updated_fields: {
        dataset: Object.keys(datasetUpdates),
        data_request: Object.keys(drUpdates)
      }
    };
  } catch (error) {
    throw new Error(`Dataset update failed: ${error.message}`);
  }
}

async function updateChart(payload) {
  const {
    chart_id, dataset_id, spec, team_id,
    name, legend, type, subType, displayLegend, pointRadius,
    dataLabels, includeZeros, timeInterval, stacked, horizontal,
    showGrowth, invertGrowth, mode, maxValue, minValue, ranges,
    datasetColor, fillColor, fill, multiFill, excludedFields, sort, columnsOrder, maxRecords, goal
  } = payload;

  if (!chart_id) {
    throw new Error("chart_id is required to update a chart");
  }

  if (!team_id) {
    throw new Error("team_id is required to update a chart");
  }

  try {
    // Find the existing chart
    const chart = await db.Chart.findByPk(chart_id);
    if (!chart) {
      throw new Error("Chart not found");
    }

    // Verify team ownership through project
    const project = await db.Project.findByPk(chart.project_id);
    if (!project || project.team_id !== team_id) {
      throw new Error("Chart does not belong to the specified team");
    }

    // Provide default chart spec if not provided
    const defaultSpec = {
      displayLegend: true,
      pointRadius: 0,
      dataLabels: false,
      includeZeros: true,
      stacked: false,
      horizontal: false,
      showGrowth: false,
      invertGrowth: false,
      mode: "chart",
    };

    const chartSpec = spec || defaultSpec;

    // Update chart fields (only if provided)
    const chartUpdates = {};
    if (name !== undefined) chartUpdates.name = name;
    if (type !== undefined) chartUpdates.type = type;
    if (subType !== undefined) chartUpdates.subType = subType;
    if (displayLegend !== undefined) chartUpdates.displayLegend = displayLegend;
    else if (chartSpec.displayLegend !== undefined) {
      chartUpdates.displayLegend = chartSpec.displayLegend;
    }
    if (pointRadius !== undefined) {
      chartUpdates.pointRadius = pointRadius;
    } else if (chartSpec.pointRadius !== undefined) {
      chartUpdates.pointRadius = chartSpec.pointRadius;
    }
    if (dataLabels !== undefined) {
      chartUpdates.dataLabels = dataLabels;
    } else if (chartSpec.dataLabels !== undefined) {
      chartUpdates.dataLabels = chartSpec.dataLabels;
    }
    if (includeZeros !== undefined) {
      chartUpdates.includeZeros = includeZeros;
    } else if (chartSpec.includeZeros !== undefined) {
      chartUpdates.includeZeros = chartSpec.includeZeros;
    }
    if (timeInterval !== undefined) {
      chartUpdates.timeInterval = timeInterval;
    } else if (chartSpec.timeInterval !== undefined) {
      chartUpdates.timeInterval = chartSpec.timeInterval;
    }

    if (stacked !== undefined) {
      chartUpdates.stacked = stacked;
    } else if (chartSpec.stacked !== undefined || chartSpec.options?.stacked !== undefined) {
      chartUpdates.stacked = chartSpec.stacked ?? chartSpec.options?.stacked ?? false;
    }

    if (horizontal !== undefined) {
      chartUpdates.horizontal = horizontal;
    } else if (chartSpec.horizontal !== undefined || chartSpec.options?.horizontal !== undefined) {
      chartUpdates.horizontal = horizontal
        ?? chartSpec.horizontal ?? chartSpec.options?.horizontal ?? false;
    }

    if (showGrowth !== undefined) {
      chartUpdates.showGrowth = showGrowth;
    } else if (chartSpec.showGrowth !== undefined) chartUpdates.showGrowth = chartSpec.showGrowth;

    if (invertGrowth !== undefined) {
      chartUpdates.invertGrowth = invertGrowth;
    } else if (chartSpec.invertGrowth !== undefined) {
      chartUpdates.invertGrowth = chartSpec.invertGrowth;
    }

    if (mode !== undefined) {
      chartUpdates.mode = mode;
    } else if (chartSpec.mode !== undefined) {
      chartUpdates.mode = chartSpec.mode;
    }

    if (maxValue !== undefined) chartUpdates.maxValue = maxValue;
    else if (chartSpec.maxValue !== undefined) {
      chartUpdates.maxValue = chartSpec.maxValue;
    }

    if (minValue !== undefined) {
      chartUpdates.minValue = minValue;
    } else if (chartSpec.minValue !== undefined) {
      chartUpdates.minValue = chartSpec.minValue;
    }
    if (ranges !== undefined) {
      chartUpdates.ranges = ranges;
    } else if (chartSpec.ranges !== undefined) {
      chartUpdates.ranges = chartSpec.ranges;
    }

    if (Object.keys(chartUpdates).length > 0) {
      await db.Chart.update(chartUpdates, { where: { id: chart_id } });
    }

    // Find and update the chart dataset config (if dataset_id is provided)
    if (
      dataset_id
      || legend || datasetColor || fillColor || fill || multiFill
      || excludedFields || sort || columnsOrder || maxRecords || goal
      || pointRadius !== undefined || chartSpec.pointRadius !== undefined
    ) {
      const configWhere = { chart_id };
      if (dataset_id) {
        configWhere.dataset_id = dataset_id;
      }

      const chartDatasetConfig = await db.ChartDatasetConfig.findOne({
        where: configWhere
      });

      if (chartDatasetConfig) {
        const configUpdates = {};

        if (legend !== undefined) {
          configUpdates.legend = legend;
        } else if (chartSpec.title !== undefined) {
          configUpdates.legend = chartSpec.title;
        }

        if (datasetColor !== undefined) {
          configUpdates.datasetColor = datasetColor;
        } else if (chartSpec.datasetColor !== undefined) {
          configUpdates.datasetColor = chartSpec.datasetColor;
        } else if (chartSpec.options?.color !== undefined) {
          configUpdates.datasetColor = chartSpec.options.color;
        }

        if (fillColor !== undefined) {
          configUpdates.fillColor = fillColor;
        } else if (chartSpec.fillColor !== undefined) {
          configUpdates.fillColor = chartSpec.fillColor;
        }

        if (fill !== undefined) {
          configUpdates.fill = fill;
        } else if (chartSpec.fill !== undefined) {
          configUpdates.fill = chartSpec.fill;
        }

        if (multiFill !== undefined) {
          configUpdates.multiFill = multiFill;
        } else if (chartSpec.multiFill !== undefined) {
          configUpdates.multiFill = chartSpec.multiFill;
        }

        if (excludedFields !== undefined) {
          configUpdates.excludedFields = excludedFields;
        } else if (chartSpec.excludedFields !== undefined) {
          configUpdates.excludedFields = chartSpec.excludedFields;
        }

        if (sort !== undefined) {
          configUpdates.sort = sort;
        } else if (chartSpec.sort !== undefined) {
          configUpdates.sort = chartSpec.sort;
        }

        if (columnsOrder !== undefined) {
          configUpdates.columnsOrder = columnsOrder;
        } else if (chartSpec.columnsOrder !== undefined) {
          configUpdates.columnsOrder = chartSpec.columnsOrder;
        }

        if (maxRecords !== undefined) {
          configUpdates.maxRecords = maxRecords;
        } else if (chartSpec.maxRecords !== undefined) {
          configUpdates.maxRecords = chartSpec.maxRecords;
        }

        if (goal !== undefined) {
          configUpdates.goal = goal;
        } else if (chartSpec.goal !== undefined) {
          configUpdates.goal = chartSpec.goal;
        }

        if (chartSpec.formula !== undefined) {
          configUpdates.formula = chartSpec.formula;
        }

        if (pointRadius !== undefined) {
          configUpdates.pointRadius = pointRadius;
        } else if (chartSpec.pointRadius !== undefined) {
          configUpdates.pointRadius = chartSpec.pointRadius;
        }

        if (Object.keys(configUpdates).length > 0) {
          await db.ChartDatasetConfig.update(
            configUpdates, { where: { id: chartDatasetConfig.id } }
          );
        }
      }
    }

    // Run the chart update in the background
    try {
      const chartController = new ChartController();
      chartController.updateChartData(chart_id, null, {});
    } catch {
      // Ignore background update errors
    }

    // Refresh the chart to get updated values
    const updatedChart = await db.Chart.findByPk(chart_id, {
      include: [{
        model: db.Project,
        attributes: ["id", "name"]
      }]
    });

    return {
      chart_id: updatedChart.id,
      name: updatedChart.name,
      type: updatedChart.type,
      project_id: updatedChart.project_id,
      dashboard_url: `${clientUrl}/${team_id}/${updatedChart.project_id}/dashboard`,
      chart_url: `${clientUrl}/${team_id}/${updatedChart.project_id}/chart/${updatedChart.id}/edit`,
      updated_fields: {
        chart: Object.keys(chartUpdates),
        config: dataset_id || legend || datasetColor || fillColor || fill || multiFill || excludedFields || sort || columnsOrder || maxRecords || goal ? "chart_dataset_config" : null
      }
    };
  } catch (error) {
    throw new Error(`Chart update failed: ${error.message}`);
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
      description: "Create a chart and place it on a project/dashboard, bound to a dataset. CRITICAL: Use the EXACT project_id specified by the user. Create the chart exactly once - do not create test/validation charts in other projects.",
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
          showGrowth: { type: "boolean", description: "Show percentage growth" },
          invertGrowth: { type: "boolean", description: "Invert growth calculation" },
          mode: { type: "string", enum: ["chart", "kpichart"] },
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
- Inform users when they request unsupported data sources (APIs, etc.) that these will be available in future updates
- Only suggest actions that correspond to these tools - no exports, sharing features, or other unimplemented functionality

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
     * Summarize the results and offer to create a chart

2. When creating charts:
   - **CRITICAL: NEVER create validation, test, or trial charts.** Create the chart exactly once, in the exact project specified by the user.
   - **CRITICAL: Always use the exact project provided by the user or context.** Never create charts in different projects for testing or validation purposes.
   - **CRITICAL: One attempt only.** Do not create multiple charts to "test" or "validate" - create the final chart directly in the user's specified project.
   - Suggest the most appropriate chart type based on the data
   - Consider: KPI for single values, line for time series, bar for comparisons, pie for proportions
   - Only ask user for confirmation if absolutely necessary - take initiative as much as possible
   - Create the dataset first, then the chart
   - When creating charts, provide a descriptive name that reflects the data being visualized (e.g., "Monthly Sales Trends" instead of "AI Generated Chart")
   - When creating resources, integrate clickable markdown links naturally into your response sentences instead of listing them separately (e.g., "I've created your chart! You can [view it here](chart_url) or [see it on your dashboard](dashboard_url)" - NOT "Chart URL: url, Dashboard URL: url")
   - Keep responses conversational and focused on insights/results rather than listing technical metadata like IDs and connection details
   - Avoid dumping raw data tables or full datasets in responses - summarize key insights conversationally instead
   - When answering data questions, give the direct answer first, then optionally show the query used - skip technical details like execution time, connection info, and alternative queries unless asked

3. Best practices:
   - **CRITICAL: Respect user instructions exactly.** If the user specifies a project_id, use that exact project_id. Never create charts in other projects for any reason.
   - **CRITICAL: No validation or test runs.** When creating charts or datasets, create them directly in the user's specified project. Do not create test/validation versions first.
   - Always confirm connection choice if multiple databases contain similar data
   - Ask before making permanent changes (updating datasets/charts)
   - Take initiative when creating datasets/charts - ask confirmation only if absolutely necessary
   - Only suggest actions and features that are actually available through your tools - avoid promising features that don't exist in Chartbrew
   - Use clear, non-technical language when summarizing data
   - In continuing conversations, reference previous work and build upon it
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
- **CRITICAL: When creating charts or datasets, use the EXACT project_id specified by the user. Never create validation/test versions in other projects. Create entities exactly once, directly in the user's specified project.**
- If you're unsure about anything, ask the user for clarification using the disambiguate tool
- **FORMATTING REMINDER**: When using cb-actions, ALWAYS use the exact fenced code block format with three backticks. Never output cb-actions without the proper markdown code fence markers.

At the end of every answer, STOP and check:
- If you included a cb-actions block, check that it is valid JSON and that the action type is "reply".
- If you asked a question or offered choices, add quick replies now so the user can respond with one click.
- **FINAL CHECK**: If you used cb-actions, verify it has proper markdown code fence formatting - if not, fix it immediately.
`;
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
  teamId, question, conversationHistory = [], conversation = null, context = null
) {
  if (!openaiClient) {
    throw new Error("OpenAI client is not initialized. Please check your environment variables.");
  }

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
      ...conversationHistory,
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
    ...conversationHistory
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

  // Initial API call
  const startTime1 = Date.now();
  let response = await openaiClient.chat.completions.create({
    model: openAiModel || "gpt-4o-mini",
    messages,
    tools,
    tool_choice: "auto",
  });
  const elapsedMs1 = Date.now() - startTime1;

  // Record first usage
  if (response.usage) {
    usageRecords.push({
      model: openAiModel || "gpt-4o-mini",
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
        if (toolName === "create_dataset" || toolName === "run_query" || toolName === "create_chart" || toolName === "update_dataset" || toolName === "update_chart") {
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
    const startTime = Date.now();
    // eslint-disable-next-line no-await-in-loop
    response = await openaiClient.chat.completions.create({
      model: openAiModel || "gpt-4o-mini",
      messages: updatedMessages,
      tools,
      tool_choice: "auto",
    });
    const elapsedMs = Date.now() - startTime;

    // Record usage for this API call
    if (response.usage) {
      usageRecords.push({
        model: openAiModel || "gpt-4o-mini",
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
  };
}

module.exports = {
  availableTools,
  orchestrate,
  buildSemanticLayer,
};
