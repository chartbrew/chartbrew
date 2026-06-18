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
const { sanitizeSnippet } = require("../../updateAudit");
const { emitProgressEvent, parseProgressEvents } = require("./responseParser");
const { ENTITY_CREATION_RULES } = require("./entityCreationRules");
const { isCapabilityQuestion, generateCapabilityResponse } = require("./capabilityHandler");
const {
  formatSupportedSourceBullets,
  formatSupportedSourceList,
  getQueryGenerationDialectIds,
  getQueryGenerationSourceIds,
  getSupportedDialectIds,
  getSupportedSourceIds,
  getSupportedSourceForConnection,
  getTemplateSourceIds,
} = require("./sourceSupport");

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
  createDashboard,
  createDashboardChart,
  createDashboardFromTemplate,
  moveChartToDashboard,
  disambiguate,
  sourceGetCapabilities,
  sourceGetSampleData,
  sourceListResources,
  sourceListTemplates,
  sourcePlanDataset,
  sourcePreviewConfiguration,
  sourceRecommendTemplates,
  sourceResolveContext,
  sourceRunAction,
  sourceSearchRecords,
  sourceValidateConfiguration,
  stripeOfficialPlanDataset,
  stripeOfficialPreviewConfiguration,
  stripeOfficialValidateConfiguration,
} = require("./tools");
const { chartColors } = require("../../../charts/colors");

// Make global variables available to tool functions
global.openaiClient = openaiClient;
global.openAiModel = openAiModel;
global.clientUrl = clientUrl;

const TEAM_SCOPED_TOOLS = new Set([
  "list_connections",
  "get_schema",
  "validate_query",
  "run_query",
  "create_dataset",
  "create_chart",
  "update_dataset",
  "update_chart",
  "create_temporary_chart",
  "create_dashboard",
  "create_dashboard_chart",
  "create_dashboard_from_template",
  "move_chart_to_dashboard",
  "source_get_capabilities",
  "source_list_resources",
  "source_get_sample_data",
  "source_list_templates",
  "source_recommend_templates",
  "source_resolve_context",
  "source_run_action",
  "source_search_records",
  "source_plan_dataset",
  "source_validate_configuration",
  "source_preview_configuration",
  "stripe_official_plan_dataset",
  "stripe_official_validate_configuration",
  "stripe_official_preview_configuration",
]);

const USER_SCOPED_TOOLS = new Set([
  "create_dashboard",
  "create_dashboard_from_template",
]);

const ORIGINAL_QUESTION_TOOLS = new Set([
  "create_dataset",
  "create_chart",
  "create_temporary_chart",
  "create_dashboard_chart",
  "create_dashboard_from_template",
  "source_resolve_context",
  "source_search_records",
  "source_plan_dataset",
  "stripe_official_plan_dataset",
]);

async function availableTools() {
  const supportedSourceList = formatSupportedSourceList();
  const supportedDialectIds = getSupportedDialectIds();
  const supportedSourceIds = getSupportedSourceIds();
  const templateSourceIds = getTemplateSourceIds();
  const queryGenerationDialectIds = getQueryGenerationDialectIds();
  const queryGenerationSourceIds = getQueryGenerationSourceIds();

  return [
    {
      name: "list_connections",
      displayName: "Find data sources",
      description: `List AI-orchestrator-supported source connections (${supportedSourceList}) available to the project/user context.`,
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          scope: { type: "string", enum: ["all", "dashboard", "recent"], default: "all" }
        },
        required: ["project_id"]
      }
      // returns: { connections: [{ id, type, subType, source_id, source_name, name }] }
    },
    {
      name: "get_schema",
      displayName: "Read data structure",
      description: `Get schema information for supported source connections (${supportedSourceList}).`,
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
      name: "source_get_capabilities",
      displayName: "Check source capabilities",
      description: "Get source-owned AI capabilities, source instructions, caveats, and supported workflow modes for a connection.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" }
        },
        required: ["connection_id"]
      }
    },
    {
      name: "source_list_resources",
      displayName: "List source resources",
      description: "List source-owned resources, metrics, dimensions, filters, and compiled metrics for a connection.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" }
        },
        required: ["connection_id"]
      }
    },
    {
      name: "source_get_sample_data",
      displayName: "Fetch sample data",
      description: "Fetch a small capped source-owned sample for resource exploration. Use only for read-only previews.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          resource: { type: "string" },
          row_limit: { type: "integer", default: 5 }
        },
        required: ["connection_id", "resource"]
      }
    },
    {
      name: "source_list_templates",
      displayName: "List templates",
      description: "List source-owned chart template packs and template summaries for a connection.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" }
        },
        required: ["connection_id"]
      }
    },
    {
      name: "source_recommend_templates",
      displayName: "Recommend templates",
      description: "Recommend source-owned templates that match the user's business goal.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          question: { type: "string" }
        },
        required: ["connection_id", "question"]
      }
    },
    {
      name: "source_resolve_context",
      displayName: "Resolve source context",
      description: "Resolve source-owned business context such as Jira projects, boards, sprints, versions, and users without asking for raw IDs. Use this for corrections, follow-ups, or explicit context inspection.",
      parameters: {
        type: "object",
        properties: {
          source_id: { type: "string", enum: supportedSourceIds },
          connection_id: { type: "string" },
          question: { type: "string" },
          intent: { type: "object" },
          overrides: { type: "object" },
          mode: { type: "string", enum: ["preview", "persist"], default: "preview" }
        },
        required: ["connection_id", "question"]
      }
    },
    {
      name: "source_plan_dataset",
      displayName: "Plan dataset",
      description: "Plan a source-owned DataRequest configuration and chart bindings from a natural-language request. Use this for configuration-based sources instead of generate_query.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          question: { type: "string" },
          overrides: { type: "object", description: "Optional explicit source configuration overrides such as date range, filters, pagination, metric, dimension, or resource." },
          mode: { type: "string", enum: ["preview", "persist"], default: "preview", description: "Use preview for temporary exploration. Use persist before creating saved datasets, charts, or dashboards so the source can request disambiguation instead of guessing IDs." }
        },
        required: ["connection_id", "question"]
      }
    },
    {
      name: "source_run_action",
      displayName: "Run source action",
      description: "Run a bounded source-owned metadata action such as Jira listUsers, listProjects, listBoards, listSprints, listVersions, validateJql, or previewJql. Use this to inspect source context without asking users for raw IDs.",
      parameters: {
        type: "object",
        properties: {
          source_id: { type: "string", enum: supportedSourceIds },
          connection_id: { type: "string" },
          action: { type: "string" },
          params: { type: "object" },
          row_limit: { type: "integer", default: 25 }
        },
        required: ["connection_id", "action"]
      }
    },
    {
      name: "source_search_records",
      displayName: "Search source records",
      description: "Search compact source-owned records for answer-first questions without creating a dataset. For Jira, use this for issue tables such as open issues by assignee, blockers, active sprint issues, and similar small result sets.",
      parameters: {
        type: "object",
        properties: {
          source_id: { type: "string", enum: supportedSourceIds },
          connection_id: { type: "string" },
          question: { type: "string" },
          resource: { type: "string" },
          filters: { type: "object" },
          jql: { type: "string" },
          fields: { type: "array", items: { type: "string" } },
          overrides: { type: "object" },
          row_limit: { type: "integer", default: 25 }
        },
        required: ["connection_id", "question"]
      }
    },
    {
      name: "source_validate_configuration",
      displayName: "Validate configuration",
      description: "Validate a source-owned DataRequest configuration before previewing or creating a dataset.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          configuration: { type: "object" }
        },
        required: ["connection_id", "configuration"]
      }
    },
    {
      name: "source_preview_configuration",
      displayName: "Preview data",
      description: "Run a capped preview for a source-owned DataRequest configuration and return compact rows, columns, warnings, and recommended chart bindings.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          configuration: { type: "object" },
          row_limit: { type: "integer", default: 25 }
        },
        required: ["connection_id", "configuration"]
      }
    },
    {
      name: "stripe_official_plan_dataset",
      displayName: "Plan Stripe dataset",
      description: "Compatibility alias for source_plan_dataset on Stripe Official connections. Prefer source_plan_dataset for new source-owned workflows.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          question: { type: "string" },
          overrides: { type: "object", description: "Optional explicit Stripe configuration overrides such as dateRange, currency, filters, pagination, mode, metric, dimension, or compiledMetric." }
        },
        required: ["connection_id", "question"]
      }
    },
    {
      name: "stripe_official_validate_configuration",
      displayName: "Validate Stripe configuration",
      description: "Compatibility alias for source_validate_configuration on Stripe Official connections.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          configuration: { type: "object" }
        },
        required: ["connection_id", "configuration"]
      }
    },
    {
      name: "stripe_official_preview_configuration",
      displayName: "Preview Stripe data",
      description: "Compatibility alias for source_preview_configuration on Stripe Official connections.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          configuration: { type: "object" },
          row_limit: { type: "integer", default: 25 }
        },
        required: ["connection_id", "configuration"]
      }
    },
    {
      name: "generate_query",
      displayName: "Write query",
      description: `Generate source queries from natural language for supported source connections (${supportedSourceList}).`,
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          schema: { type: "object" }, // database schema from get_schema
          source_id: { type: "string", enum: queryGenerationSourceIds },
          hints: { type: "object" }, // optional project-level entity hints
          preferred_dialect: { type: "string", enum: queryGenerationDialectIds } // supported source ids/types/subtypes
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
      displayName: "Check query",
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
      displayName: "Run query",
      description: `Execute read-only source queries on query-generation connections (${supportedSourceList}) with guardrails. Do not use this for source-owned configuration sources; use source_preview_configuration instead.`,
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string" },
          dialect: { type: "string", enum: supportedDialectIds },
          query: { type: "string", description: "Read-only query for query-based sources" },
          configuration: { type: "object", description: "Legacy only. Do not pass source-owned configurations; use source_preview_configuration instead." },
          params: { type: "object" },
          row_limit: { type: "integer", default: 1000 },
          timeout_ms: { type: "integer", default: 8000 },
          allow_ddl_dml: { type: "boolean", default: false } // must be false; server enforces
        },
        required: ["connection_id", "dialect"]
      }
      // returns: { rows:[{}], columns:[{name,type}], rowCount, elapsedMs }
    },
    {
      name: "summarize",
      displayName: "Summarize results",
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
      displayName: "Choose chart type",
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
      displayName: "Create dataset",
      description: "Persist a reusable Chartbrew dataset for query/data retrieval. Dataset names are canonical in Dataset.name; chart bindings belong on ChartDatasetConfig.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Project ID where the dataset will be created" },
          connection_id: { type: "string", description: `Connection ID to use for data fetching (must be one of: ${supportedSourceList})` },
          name: { type: "string", description: "Canonical dataset name stored on Dataset.name" },
          query: { type: "string", description: "Source query for query-based sources. Leave null/omitted for configuration-based sources." },
          conditions: { type: "array", items: { type: "object" }, description: "DataRequest conditions for condition-based source-owned connectors" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], description: "DataRequest HTTP method for route-based source-owned connectors" },
          route: { type: "string", description: "DataRequest route/path for route-based source-owned connectors" },
          itemsLimit: { type: "integer", description: "Maximum records to fetch for route-based source-owned connectors" },
          configuration: { type: "object", description: "DataRequest dialect-specific settings" },
          variables: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "Parameterized query variables"
          },
          transform: { type: "object", description: "Data transformation rules" }
        },
        required: ["connection_id", "name"]
      }
      // returns: { dataset_id, data_request_id, name, dataset_url }
    },
    {
      name: "create_chart",
      displayName: "Create chart",
      description: "Create a chart and place it on a visible project/dashboard. CRITICAL: ONLY use this when the user EXPLICITLY requests placing a chart in a specific dashboard, including a new dashboard created with create_dashboard in this same workflow. DEFAULT to create_temporary_chart instead. Use the EXACT project_id specified by the user or returned by create_dashboard.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "The EXACT project/dashboard ID specified by the user where the chart will be placed. Use this exact ID - never create charts in other projects for testing or validation." },
          dataset_id: { type: "string" },
          name: { type: "string", description: "Chart name/title" },
          legend: { type: "string", description: "Chart-series label stored on ChartDatasetConfig.legend (max 20-30 chars, appears on hover)" },
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
          xAxis: { type: "string", description: "ChartDatasetConfig x-axis field using traversal syntax (use 'root[].field_name' for array results)" },
          xAxisOperation: { type: "string", description: "ChartDatasetConfig x-axis operation" },
          yAxis: { type: "string", description: "ChartDatasetConfig y-axis field using traversal syntax (use 'root[].field_name' for array results)" },
          yAxisOperation: {
            type: "string",
            enum: ["none", "sum", "avg", "min", "max", "count"],
            default: "none",
            description: "ChartDatasetConfig y-axis aggregation operation"
          },
          dateField: { type: "string", description: "ChartDatasetConfig date field for filtering" },
          dateFormat: { type: "string", description: "ChartDatasetConfig date format (e.g. YYYY-MM-DD)" },
          conditions: { type: "array", items: { type: "object" }, description: "ChartDatasetConfig chart-specific filtering conditions" },
          formula: { type: "string", description: "ChartDatasetConfig formula for transforming displayed values" },
          seriesConfiguration: { type: "object", description: "ChartDatasetConfig.configuration for series-specific settings such as variable overrides" },
          spec: { type: "object", description: "Alternative: Chart specification object (backward compatibility)" }
        },
        required: ["project_id", "dataset_id", "name"]
      }
      // returns: { chart_id, name, type, project_id, dashboard_url, chart_url }
    },
    {
      name: "update_dataset",
      displayName: "Update dataset",
      description: "Update an existing dataset and its associated data request with new reusable dataset metadata, source query, or data-request configuration. Do not use this tool for chart binding fields.",
      parameters: {
        type: "object",
        properties: {
          dataset_id: { type: "string", description: "The ID of the dataset to update" },
          name: { type: "string", description: "New canonical dataset name stored on Dataset.name" },
          query: { type: "string", description: "New source query for the dataset" },
          configuration: { type: "object", description: "Updated DataRequest dialect-specific settings" },
          variables: { type: "array", items: { type: "string" }, description: "Query variables/parameters" },
          transform: { type: "object", description: "Data transformation rules" }
        },
        required: ["dataset_id"]
      }
      // returns: { dataset_id, data_request_id, name, dataset_url, updated_fields }
    },
    {
      name: "update_chart",
      displayName: "Update chart",
      description: "Update an existing chart with new chart properties or ChartDatasetConfig series settings, including CDC-owned bindings like xAxis, yAxis, dateField, and conditions.",
      parameters: {
        type: "object",
        properties: {
          chart_id: { type: "string", description: "The ID of the chart to update" },
          dataset_id: { type: "string", description: "New dataset ID (if changing the dataset)" },
          name: { type: "string", description: "New chart name/title" },
          legend: { type: "string", description: "Chart-series label stored on ChartDatasetConfig.legend (max 20-30 chars, appears on hover)" },
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
          xAxis: { type: "string", description: "ChartDatasetConfig x-axis field using traversal syntax (use 'root[].field_name' for array results)" },
          xAxisOperation: { type: "string", description: "ChartDatasetConfig x-axis operation" },
          yAxis: { type: "string", description: "ChartDatasetConfig y-axis field using traversal syntax (use 'root[].field_name' for array results)" },
          yAxisOperation: {
            type: "string",
            enum: ["none", "sum", "avg", "min", "max", "count"],
            description: "ChartDatasetConfig y-axis aggregation operation"
          },
          dateField: { type: "string", description: "ChartDatasetConfig date field for filtering" },
          dateFormat: { type: "string", description: "ChartDatasetConfig date format (e.g. YYYY-MM-DD)" },
          conditions: { type: "array", items: { type: "object" }, description: "ChartDatasetConfig chart-specific filtering conditions" },
          formula: { type: "string", description: "ChartDatasetConfig formula for transforming displayed values" },
          seriesConfiguration: { type: "object", description: "ChartDatasetConfig.configuration for series-specific settings such as variable overrides" },
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
      displayName: "Create chart preview",
      description: "DEFAULT tool for creating charts. Create a temporary preview chart that shows the data visually without placing it in a visible dashboard. This creates a reusable dataset plus a ChartDatasetConfig that owns the series bindings. Use this for chart creation requests UNLESS the user explicitly says to create a dashboard, add to a dashboard, or place in a dashboard.",
      parameters: {
        type: "object",
        properties: {
          connection_id: { type: "string", description: `Connection ID to use for data fetching (must be one of: ${supportedSourceList})` },
          name: { type: "string", description: "Chart name/title" },
          legend: { type: "string", description: "Chart-series label stored on ChartDatasetConfig.legend (max 20-30 chars, appears on hover)" },
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
          xAxis: { type: "string", description: "ChartDatasetConfig x-axis field using traversal syntax (use 'root[].field_name' for array results)" },
          xAxisOperation: { type: "string", description: "ChartDatasetConfig x-axis operation" },
          yAxis: { type: "string", description: "ChartDatasetConfig y-axis field using traversal syntax (use 'root[].field_name' for array results)" },
          yAxisOperation: {
            type: "string",
            enum: ["none", "sum", "avg", "min", "max", "count"],
            default: "none",
            description: "ChartDatasetConfig y-axis aggregation operation"
          },
          dateField: { type: "string", description: "ChartDatasetConfig date field for filtering" },
          dateFormat: { type: "string", description: "ChartDatasetConfig date format (e.g. YYYY-MM-DD)" },
          query: { type: "string", description: "Source query for query-based sources. Leave null/omitted for configuration-based sources." },
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], description: "DataRequest HTTP method for route-based source-owned connectors" },
          route: { type: "string", description: "DataRequest route/path for route-based source-owned connectors" },
          itemsLimit: { type: "integer", description: "Maximum records to fetch for route-based source-owned connectors" },
          conditions: { type: "array", items: { type: "object" }, description: "ChartDatasetConfig chart-specific filtering conditions" },
          configuration: { type: "object", description: "DataRequest dialect-specific settings for the reusable dataset" },
          variables: {
            type: "array",
            items: { type: "string" },
            default: [],
            description: "Query variables/parameters"
          },
          transform: { type: "object", description: "Data transformation rules" },
          formula: { type: "string", description: "ChartDatasetConfig formula for transforming displayed values" },
          seriesConfiguration: { type: "object", description: "ChartDatasetConfig.configuration for series-specific settings such as variable overrides" },
          spec: { type: "object", description: "Alternative: Chart specification object (backward compatibility)" }
        },
        required: ["connection_id", "name"]
      }
      // returns: {
      //   chart_id, dataset_id, data_request_id, name, type,
      //   is_temporary: true, ghost_project_id
      // }
    },
    {
      name: "create_dashboard",
      displayName: "Create dashboard",
      description: "Create an empty visible dashboard/project. Use this for multi-source dashboard requests, then create datasets/charts or template dashboards into the returned project_id.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name for the new dashboard" }
        },
        required: ["name"]
      }
      // returns: { project_id, name, dashboard_url }
    },
    {
      name: "create_dashboard_chart",
      displayName: "Create dashboard chart",
      description: "Create a reusable dataset and chart directly inside a visible dashboard in one operation. Use this after create_dashboard for custom mixed-source dashboard charts from databases, APIs, or source-owned planned configurations. Prefer this over separate create_dataset then create_chart calls when the destination dashboard is already known.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string", description: "Dashboard/project ID where the chart should be placed" },
          connection_id: { type: "string", description: `Connection ID to use for data fetching (must be one of: ${supportedSourceList})` },
          name: { type: "string", description: "Chart and dataset name/title" },
          legend: { type: "string", description: "Chart-series label stored on ChartDatasetConfig.legend" },
          type: { type: "string", enum: ["line", "bar", "pie", "doughnut", "radar", "polar", "table", "kpi", "avg", "gauge", "matrix"] },
          subType: { type: "string", description: "Chart subtype, for example AddTimeseries for KPI totals" },
          displayLegend: { type: "boolean" },
          pointRadius: { type: "integer" },
          dataLabels: { type: "boolean" },
          includeZeros: { type: "boolean" },
          timeInterval: { type: "string", enum: ["second", "minute", "hour", "day", "week", "month", "year"] },
          stacked: { type: "boolean" },
          horizontal: { type: "boolean" },
          xLabelTicks: { type: "string", enum: ["default", "half", "third", "fourth", "showAll"] },
          showGrowth: { type: "boolean" },
          invertGrowth: { type: "boolean" },
          mode: { type: "string", enum: ["chart", "kpichart"] },
          maxValue: { type: "integer" },
          minValue: { type: "integer" },
          ranges: { type: "array", items: { type: "object" } },
          xAxis: { type: "string", description: "ChartDatasetConfig x-axis field using traversal syntax" },
          xAxisOperation: { type: "string" },
          yAxis: { type: "string", description: "ChartDatasetConfig y-axis field using traversal syntax" },
          yAxisOperation: { type: "string", enum: ["none", "sum", "avg", "min", "max", "count"], default: "none" },
          dateField: { type: "string" },
          dateFormat: { type: "string" },
          query: { type: "string", description: "Source query for query-based sources" },
          method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
          route: { type: "string" },
          itemsLimit: { type: "integer" },
          conditions: { type: "array", items: { type: "object" } },
          configuration: { type: "object", description: "DataRequest dialect-specific settings for source-owned connectors" },
          variables: { type: "array", items: { type: "string" }, default: [] },
          variableBindings: { type: "array", items: { type: "object" } },
          transform: { type: "object" },
          formula: { type: "string" },
          seriesConfiguration: { type: "object" },
          spec: { type: "object", description: "Alternative chart specification object" }
        },
        required: ["project_id", "connection_id", "name"]
      }
      // returns: { chart_id, dataset_id, data_request_id, project_id, dashboard_url, chart_url }
    },
    {
      name: "create_dashboard_from_template",
      displayName: "Create dashboard from template",
      description: "Create a full dashboard/project from a source-owned template bundle. This is generic across template-backed sources. Use when the user asks for a full source-specific dashboard, dashboard bundle, or starter dashboard. For multi-source dashboard requests, first use create_dashboard, then call this with dashboard.type=existing and the returned project_id.",
      parameters: {
        type: "object",
        properties: {
          source_id: { type: "string", enum: templateSourceIds, description: "Source plugin id that owns the template, for example jira, stripe, or stripeOfficial" },
          template_slug: { type: "string", description: "Template slug from source_list_templates or source_recommend_templates" },
          connection_id: { type: "string", description: `Connection ID to use for data fetching (must be one of: ${supportedSourceList})` },
          dashboard: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["new", "existing"] },
              name: { type: "string", description: "Name for a new dashboard" },
              project_id: { type: "string", description: "Existing dashboard/project ID" }
            },
            required: ["type"],
            description: "Destination dashboard. Use type=new with a name when creating a new dashboard, or type=existing with project_id when the user names an existing dashboard."
          },
          dataset_template_ids: { type: "array", items: { type: "string" }, description: "Optional selected dataset template ids. Omit to create all datasets in the template." },
          chart_template_ids: { type: "array", items: { type: "string" }, description: "Optional selected chart template ids. Omit to create all charts in the template." },
          variable_defaults: { type: "object", description: "Default values for template variable bindings, for example { projects: 'CHART', sprint_id: '123' } for Jira templates." }
        },
        required: ["source_id", "template_slug", "connection_id", "dashboard"]
      }
      // returns: { project_id, dashboard_url, datasets, charts }
    },
    {
      name: "move_chart_to_dashboard",
      displayName: "Add chart to dashboard",
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
      displayName: "Ask for clarification",
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
      case "create_dashboard":
        return createDashboard(payload);
      case "create_dashboard_chart":
        return createDashboardChart(payload);
      case "create_dashboard_from_template":
        return createDashboardFromTemplate(payload);
      case "move_chart_to_dashboard":
        return moveChartToDashboard(payload);
      case "disambiguate":
        return disambiguate(payload);
      case "source_get_capabilities":
        return sourceGetCapabilities(payload);
      case "source_list_resources":
        return sourceListResources(payload);
      case "source_get_sample_data":
        return sourceGetSampleData(payload);
      case "source_list_templates":
        return sourceListTemplates(payload);
      case "source_recommend_templates":
        return sourceRecommendTemplates(payload);
      case "source_resolve_context":
        return sourceResolveContext(payload);
      case "source_plan_dataset":
        return sourcePlanDataset(payload);
      case "source_run_action":
        return sourceRunAction(payload);
      case "source_search_records":
        return sourceSearchRecords(payload);
      case "source_validate_configuration":
        return sourceValidateConfiguration(payload);
      case "source_preview_configuration":
        return sourcePreviewConfiguration(payload);
      case "stripe_official_plan_dataset":
        return stripeOfficialPlanDataset(payload);
      case "stripe_official_validate_configuration":
        return stripeOfficialValidateConfiguration(payload);
      case "stripe_official_preview_configuration":
        return stripeOfficialPreviewConfiguration(payload);
      default:
        throw new Error(`Tool ${name} not found`);
    }
  } catch (error) {
    throw new Error(`Tool ${name} execution failed: ${sanitizeToolError(error)}`);
  }
}

function sanitizeToolError(error) {
  return sanitizeSnippet(error?.message || error || "Tool execution failed", 1000) || "Tool execution failed";
}

function buildSystemPrompt(semanticLayer, conversation = null) {
  const { connections, projects, chartCatalog } = semanticLayer;
  const supportedConnections = connections
    .map((connection) => ({
      connection,
      source: getSupportedSourceForConnection(connection),
    }))
    .filter(({ source }) => source);
  const supportedSourceList = formatSupportedSourceList();

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
${supportedConnections.map(({ connection, source }) => `- ${connection.name} (${source.name}; ${connection.type}${connection.subType ? `/${connection.subType}` : ""}) [ID: ${connection.id}]`).join("\n")}

Note: Source plugins that declare AI query generation or source-owned AI tools are available to the orchestrator:
${formatSupportedSourceBullets()}

API connections and other sources will be available when their source plugins declare AI support.

## Available Projects
${projects.map((p) => `- ${p.name} [ID: ${p.id}] - ${p.Charts?.length || 0} charts`).join("\n")}

## Chart Types Available
${chartCatalog.map((catalog) => Object.entries(catalog).map(([type, info]) => `- ${type}: ${info.description}`).join("\n")).join("\n")}

## How Chartbrew Works
1. **Connections**: Store source credentials and schemas. Supported AI sources in this environment: ${supportedSourceList}
2. **DataRequests**: Define how to fetch data using source-specific queries
3. **Datasets**: Reusable query/data definitions backed by DataRequests
4. **Charts**: Visual representations of Datasets, placed in Projects (dashboards)
5. **ChartDatasetConfigs**: Link Charts to Datasets with chart-specific bindings, filters, labels, and display settings

${ENTITY_CREATION_RULES}

## Your Capabilities
- List and identify appropriate supported source connections
- Retrieve database schemas with tables, columns, and sample data
- Generate source queries from natural language for supported sources
- Use source-owned AI tools for configuration-based sources
- Execute source queries and summarize results
- Suggest appropriate chart types for data
- Create datasets and charts in projects
- Create empty dashboards for mixed-source dashboard requests
- Create source-backed charts directly in known dashboards with one tool call
- Create full dashboards from source-owned template bundles when the user asks for a starter dashboard or dashboard pack
- Create temporary charts when no project is specified, then move them to dashboards upon user confirmation
- Inform users when they request unsupported data sources that these will be available when the corresponding source plugin declares AI query support
- Only suggest actions that correspond to these tools - no exports, sharing features, or other unimplemented functionality

## Core Principle: Take Initiative
**Be proactive, not reactive.** Your default mode should be to act, not ask.

- **Infer context automatically**: For connections and data sources, use context from the conversation. If only one connection exists or is obvious from context, use it automatically.
- **Use obvious connections**: If only one connection exists, or the connection is clear from context (e.g., "my sales database"), use it automatically. Only ask when multiple ambiguous options exist.
- **Create charts proactively**: After answering a data question, automatically create a TEMPORARY preview chart. Don't ask "would you like me to create a chart?" - just create it. This gives users a visual preview and control over dashboard placement.
- **Remember**: Temporary charts give users control. They can see the visualization immediately and decide where to save it. It's better to show a preview than to pollute their dashboards with unwanted charts.
- **Only ask questions when**: Context is truly ambiguous, multiple valid options exist with no clear preference, or you need clarification on user intent.

## Limitations
**Cannot generate or create data.** If asked to generate fake data, manually input data, add unsupported sources, or create databases, respond tersely: "I can't generate data. Chartbrew visualizes data from connected sources. Connect a supported source (${supportedSourceList}) via the Connections page."

## Workflow Guidelines
1. When a user asks a data question:
   - If they request data generation, fake data, manual input, or unsupported sources: Use the Limitations response above. Do not proceed.
   - Check if they have supported source connections (${supportedSourceList})
   - If they request unsupported sources: Briefly state the currently supported AI sources are ${supportedSourceList}.
   - For supported database connections:
     * Call get_schema to get database schema information
     * Call generate_query with the schema to generate source queries
     * Call run_query to execute the SQL and get results
     * Summarize the results
     * **DEFAULT: Always create a temporary preview chart to show the results visually**
   - For source-owned configuration connections:
     * Call source_get_capabilities or source_list_resources only when you truly need source context that is not already known. Do not call them as a default prerequisite for dashboard creation.
     * Use source_resolve_context when a Jira follow-up needs to inspect or correct project, board, sprint, version, or user context.
     * Use source_run_action for bounded Jira metadata lookups such as users, projects, boards, sprints, versions, or JQL validation.
     * Use source_search_records for answer-first Jira issue lists before creating datasets. This is preferred for prompts like "what is Raz working on", "show open issues assigned to X", "show blockers", or "what is in the active sprint".
     * For Jira active sprint questions without visible project or sprint context, ask for the project first. After the project is known, pass it as overrides.project to source_search_records or source_plan_dataset so Jira can resolve the active sprint directly.
     * Call source_plan_dataset with the user's business question. Use mode="preview" for exploration or temporary charts, and mode="persist" before saved datasets, saved charts, or dashboards so ambiguous source context can be clarified. Do not invent API routes or configuration fields.
     * For generic API connections: prefer source AI Context. If the source identifies a recognizable provider and returns status="needs_model_planning" or modelFallbackAllowed=true, you may use your provider/API knowledge as a fallback. In that case, call create_temporary_chart/create_dataset with explicit method, route, itemsLimit, pagination/body/header assumptions, and chart bindings. Do not use provider memory for unknown hosts.
     * Call source_validate_configuration or source_preview_configuration when you need validation, compact rows, or warnings before answering
     * For charts, pass the planned configuration to create_temporary_chart by default
     * For full single-source dashboard requests, call source_recommend_templates or source_list_templates, then create_dashboard_from_template with a source-owned template slug
     * For mixed-source dashboard requests, call create_dashboard first, then add each requested chart to that returned project_id. Use create_dashboard_from_template with dashboard.type="existing" for source-owned template sections, and create_dashboard_chart for custom charts from databases or source-owned planned configurations.
     * If the user explicitly names a dashboard/project, create the dataset with create_dataset and then place the chart with create_chart using the planned chartSpec bindings
     * If a source tool returns status="needs_more_context" without modelFallbackAllowed, stop the creation flow and guide the user with the tool message. If editConnectionUrl is present, include it as a markdown link. If contextInstructions or exampleAiContext are present, summarize exactly what to paste.
     * If a chart creation tool returns chart_created=true and snapshot_status="unavailable", say the chart was created and mention only that the rendered preview is not available yet. Do not describe that as a failed or blocked chart.
     * Never use generate_query or run_query for configuration-based sources

2. When creating charts - CRITICAL CHART PLACEMENT RULES:
   
   **🚨 IMPORTANT: Temporary charts are the DEFAULT. Only place charts in visible dashboards when explicitly requested by the user.**
   
   **Deciding between create_chart and create_temporary_chart:**
   - **DEFAULT: ALWAYS use create_temporary_chart** unless the user explicitly requests dashboard placement or asks to create a new dashboard
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
     * User says: "create a new dashboard with X, Y, and Z" after create_dashboard returns a project_id
     * **Must include BOTH: (1) chart creation intent AND (2) explicit dashboard/project name**

   **New dashboard workflow:**
   - If the user asks to create a new dashboard, use create_dashboard with a concise dashboard name
   - Use the returned project_id as the destination for every requested chart
   - For source-owned templates such as Jira sprint health, call create_dashboard_from_template with dashboard.type="existing" and that project_id
   - For database/query-based charts, use create_dashboard_chart so the dataset and chart are created in one operation
   - For source-owned planned charts that are not covered by a template, use source_plan_dataset with mode="persist", then pass the planned configuration and chartSpec fields to create_dashboard_chart
   - Avoid source_get_capabilities and source_list_resources in this workflow unless a source_plan_dataset or template tool says more context is needed
   - Do not tell the user that brand-new dashboards cannot be created; create_dashboard is available for this
   
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
- Use \`code blocks\` only for source queries when relevant - avoid technical jargon otherwise
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
        // oxlint-disable-next-line no-console
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
        // oxlint-disable-next-line no-console
        console.warn(`Removing incomplete assistant message with tool_calls. Missing responses for tool_call_ids: ${missingIds}`);
        i = j; // Skip past the incomplete sequence
      }
    } else if (message.role === "tool") {
      // Orphaned tool response (no preceding assistant message with tool_calls)
      // Remove it to prevent OpenAI API errors
      // oxlint-disable-next-line no-console
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

function buildResponseInputFromMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const input = [];

  messages.forEach((message) => {
    if (!message) {
      return;
    }

    if (message.role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      if (message.content) {
        input.push({
          type: "message",
          role: "assistant",
          content: message.content,
        });
      }

      message.tool_calls.forEach((toolCall) => {
        if (!toolCall?.function?.name || !toolCall?.id) {
          return;
        }

        input.push({
          type: "function_call",
          call_id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments || "{}",
        });
      });

      return;
    }

    if (message.role === "tool") {
      if (!message.tool_call_id) {
        return;
      }

      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id,
        output: typeof message.content === "string" ? message.content : JSON.stringify(message.content || {}),
      });
      return;
    }

    input.push({
      type: "message",
      role: message.role,
      content: typeof message.content === "string" ? message.content : JSON.stringify(message.content || {}),
    });
  });

  return input;
}

function parseToolResultContent(content) {
  if (!content || typeof content !== "string") return null;

  try {
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function getJiraResolution(result = {}) {
  if (result.source !== "jira") return null;
  if (result.resolution?.entities) return result.resolution.entities;
  return result.resolution || {};
}

function extractJiraContext(result = {}) {
  const resolution = getJiraResolution(result);
  const configuration = result.configuration || result.dataRequest?.configuration || {};
  if (!resolution) return null;

  const projectKey = resolution.project?.key || configuration.projectIdOrKey;
  const boardId = resolution.board?.id || configuration.boardId;
  const boardName = resolution.board?.name;
  const sprintId = resolution.sprint?.id || configuration.sprintId;
  const sprintName = resolution.sprint?.name;

  if (!projectKey && !boardId && !sprintId) return null;

  return [
    projectKey ? `Jira project ${projectKey}` : null,
    boardId ? `board ${boardId}${boardName ? ` (${boardName})` : ""}` : null,
    sprintId ? `sprint ${sprintId}${sprintName ? ` (${sprintName})` : ""}` : null,
  ].filter(Boolean).join(", ");
}

function collectRecentSourceContext(history = []) {
  const recentMessages = Array.isArray(history) ? history.slice(-30).reverse() : [];
  const jiraContext = recentMessages
    .filter((message) => message.role === "tool")
    .map((message) => extractJiraContext(parseToolResultContent(message.content)))
    .find(Boolean);

  if (!jiraContext) return "";

  return [
    `RECENT_SOURCE_CONTEXT: ${jiraContext}.`,
    "For Jira follow-up or correction requests, reuse this context as overrides.project, overrides.boardId, and overrides.sprintId unless the user changes it.",
  ].join("\n");
}

function buildResponseTools(toolDefinitions) {
  return toolDefinitions.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: false,
  }));
}

function buildAssistantMessageFromResponse(response) {
  const toolCalls = (response.output || [])
    .filter((item) => item.type === "function_call")
    .map((toolCall) => ({
      id: toolCall.call_id,
      type: "function",
      function: {
        name: toolCall.name,
        arguments: toolCall.arguments,
      },
    }));

  return {
    role: "assistant",
    content: response.output_text || "",
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
}

function parseToolResultContent(content) {
  try {
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function getCreatedDashboardLinks(toolResults = []) {
  return toolResults
    .map((result) => parseToolResultContent(result.content))
    .filter((result) => result?.dashboard_created && result?.dashboard_url)
    .map((result) => ({
      label: result.dashboard_name || result.name || "Open dashboard",
      url: result.dashboard_url,
    }));
}

function appendDashboardLinksToAssistantMessage(content = "", toolResults = []) {
  const dashboardLinks = getCreatedDashboardLinks(toolResults)
    .filter((link) => !content.includes(link.url));

  if (dashboardLinks.length === 0) {
    return content;
  }

  const links = dashboardLinks
    .map((link) => `[${link.label}](${link.url})`)
    .join("\n");

  return [content, links].filter(Boolean).join("\n\n");
}

function buildFallbackAssistantMessage({ toolResults = [], snapshots = [] } = {}) {
  const dashboardLinks = getCreatedDashboardLinks(toolResults);
  if (dashboardLinks.length > 0) {
    return appendDashboardLinksToAssistantMessage(
      `I created ${dashboardLinks.length === 1 ? "the dashboard" : `${dashboardLinks.length} dashboards`}.`,
      toolResults
    );
  }

  const createdCharts = toolResults
    .map((result) => parseToolResultContent(result.content))
    .filter((result) => result?.chart_created || result?.chart_id);

  if (createdCharts.length > 0) {
    const chartNames = createdCharts
      .map((result) => result.name)
      .filter(Boolean);

    if (chartNames.length > 0) {
      return `I created ${chartNames.join(", ")}.`;
    }

    return `I created ${createdCharts.length === 1 ? "the chart" : `${createdCharts.length} charts`}.`;
  }

  if (snapshots.length > 0) {
    return `I created ${snapshots.length === 1 ? "the chart" : `${snapshots.length} charts`}.`;
  }

  return "I completed the requested action, but I could not generate a final text response. Please try again or rephrase the request.";
}

function buildDisambiguationAssistantMessage({ prompt, options = [] } = {}) {
  const suggestions = options.map((option, index) => ({
    id: String(option.value || option.id || `option_${index + 1}`),
    label: option.label || option.value || `Option ${index + 1}`,
    action: "reply",
  }));

  return [
    prompt || "I need one more choice before I can continue.",
    "",
    "```cb-actions",
    JSON.stringify({
      version: 1,
      suggestions,
    }, null, 2),
    "```",
  ].join("\n");
}

function buildUsageRecordFromResponse(response, elapsedMs, model) {
  if (!response?.usage) {
    return null;
  }

  return {
    model,
    prompt_tokens: response.usage.input_tokens || 0,
    completion_tokens: response.usage.output_tokens || 0,
    total_tokens: response.usage.total_tokens || 0,
    elapsed_ms: elapsedMs,
  };
}

function buildLegacyUsageFromResponse(response) {
  if (!response?.usage) {
    return null;
  }

  return {
    prompt_tokens: response.usage.input_tokens || 0,
    completion_tokens: response.usage.output_tokens || 0,
    total_tokens: response.usage.total_tokens || 0,
  };
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
    attributes: ["id", "name", "legend", "main_dr_id"],
    include: [{
      model: db.DataRequest,
      attributes: ["id", "connection_id", "query", "conditions", "configuration", "variables", "transform"]
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
  const { toolProgressCallback, userId } = options;
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
        model: openAiModel || "gpt-5.4-nano",
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        elapsed_ms: 0,
      }],
      iterations: 0,
    };
  }

  const systemPrompt = buildSystemPrompt(semanticLayer, conversation);
  const modelName = openAiModel || "gpt-5.4-nano";
  const persistedMessages = [...sanitizedHistory];
  const modelMessages = sanitizedHistory.filter((message) => message.role !== "system");

  // Inject context as separate assistant message if provided
  if (context && Array.isArray(context) && context.length > 0) {
    const contextInfo = context.map((entity) => `${entity.label}`).join("\n");
    const contextMessage = {
      role: "assistant",
      content: `CONTEXT:\n${contextInfo}`
    };
    persistedMessages.push(contextMessage);
    modelMessages.push(contextMessage);
  }

  const recentSourceContext = collectRecentSourceContext(sanitizedHistory);
  if (recentSourceContext) {
    modelMessages.push({
      role: "assistant",
      content: recentSourceContext,
    });
  }

  // Add user message
  const userMessage = {
    role: "user",
    content: question
  };
  persistedMessages.push(userMessage);
  modelMessages.push(userMessage);

  // Get available tools in Responses API format
  const toolDefinitions = await availableTools();
  const tools = buildResponseTools(toolDefinitions);
  const toolDisplayNameByName = new Map(
    toolDefinitions.map((tool) => [tool.name, tool.displayName || tool.name])
  );

  // Track all usage records (one per API call)
  const usageRecords = [];
  // Track snapshots from chart creation/update tools
  const snapshots = [];
  let lastToolResults = [];

  const createModelResponse = async () => {
    const startTime = Date.now();
    const response = await openaiClient.responses.create({
      model: modelName,
      instructions: systemPrompt,
      input: buildResponseInputFromMessages(modelMessages),
      tools,
      tool_choice: "auto",
      parallel_tool_calls: true,
      reasoning: {
        effort: "medium",
      },
      text: {
        verbosity: "low",
      },
    });
    const elapsedMs = Date.now() - startTime;
    const usageRecord = buildUsageRecordFromResponse(response, elapsedMs, modelName);

    if (usageRecord) {
      usageRecords.push(usageRecord);
    }

    return response;
  };

  // Initial API call
  let response = await createModelResponse();
  let assistantMessage = buildAssistantMessageFromResponse(response);
  const maxIterations = 16; // Prevent infinite loops while allowing mixed-source dashboard creation
  let iterations = 0;

  // Handle tool calls in a loop
  while (
    assistantMessage.tool_calls
    && assistantMessage.tool_calls.length > 0
    && iterations < maxIterations
  ) {
    iterations++;
    persistedMessages.push(assistantMessage);
    modelMessages.push(assistantMessage);

    // Execute all tool calls in parallel
    // Emit progress for tool execution
    if (conversation?.id && assistantMessage.tool_calls.length > 0) {
      const toolNames = assistantMessage.tool_calls.map((tc) => tc.function.name);
      const toolDisplayNames = toolNames.map((toolName) => toolDisplayNameByName.get(toolName) || toolName);
      emitProgressEvent(socketManager, conversation.id, "TOOL_STARTED", {
        tools: toolNames,
        toolDisplayNames,
        toolEvents: toolNames.map((toolName, index) => ({
          type: "tool_started",
          toolName,
          displayName: toolDisplayNames[index],
          status: "running",
        })),
        status: "running",
        message: toolDisplayNames.join(", ")
      });
    }

    // oxlint-disable-next-line no-await-in-loop
    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (toolCall) => {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Inject team_id into all team-scoped tools so they cannot access cross-team resources.
        if (TEAM_SCOPED_TOOLS.has(toolName)) {
          toolArgs.team_id = teamId;
        }
        if (USER_SCOPED_TOOLS.has(toolName)) {
          toolArgs.user_id = userId;
        }
        if (ORIGINAL_QUESTION_TOOLS.has(toolName)) {
          toolArgs.original_question = question;
        }

        // Call progress callback before tool execution
        if (toolProgressCallback) {
          try {
            await toolProgressCallback(toolName, "start", toolArgs);
          } catch (callbackError) {
            // oxlint-disable-next-line no-console
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
          const safeError = sanitizeToolError(error);

          // Call progress callback on error
          if (toolProgressCallback) {
            try {
              await toolProgressCallback(toolName, "error", { error: safeError });
            } catch (callbackError) {
              // oxlint-disable-next-line no-console
              console.error("Tool progress callback error:", callbackError);
            }
          }

          return {
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolName,
            content: JSON.stringify({
              error: safeError
            })
          };
        }
      })
    );

    persistedMessages.push(...toolResults);
    modelMessages.push(...toolResults);
    lastToolResults = toolResults;

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
      const disambiguationMessage = buildDisambiguationAssistantMessage({
        prompt: disambiguationRequest.prompt,
        options: disambiguationRequest.options,
      });
      persistedMessages.push({
        role: "assistant",
        content: disambiguationMessage,
      });

      return {
        needs_user_input: true,
        message: disambiguationMessage,
        prompt: disambiguationRequest.prompt,
        options: disambiguationRequest.options,
        conversationHistory: persistedMessages,
        usage: buildLegacyUsageFromResponse(response),
        usageRecords,
        iterations,
        snapshots,
      };
    }

    // Get next response from AI
    // oxlint-disable-next-line no-await-in-loop
    response = await createModelResponse();
    assistantMessage = buildAssistantMessageFromResponse(response);
  }

  if (!assistantMessage.content) {
    assistantMessage.content = buildFallbackAssistantMessage({
      toolResults: lastToolResults,
      snapshots,
    });
  }
  assistantMessage.content = appendDashboardLinksToAssistantMessage(assistantMessage.content, lastToolResults);

  // Add final assistant message
  if (assistantMessage.content) {
    persistedMessages.push(assistantMessage);

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
    conversationHistory: persistedMessages,
    usage: buildLegacyUsageFromResponse(response), // Last API call usage (backward compatibility)
    usageRecords, // All usage records for saving to AiUsage table
    iterations,
    snapshots, // Chart snapshots from tool results
  };
}

module.exports = {
  availableTools,
  orchestrate,
  buildSemanticLayer,
  buildResponseInputFromMessages,
  buildAssistantMessageFromResponse,
  collectRecentSourceContext,
  buildDisambiguationAssistantMessage,
  buildFallbackAssistantMessage,
  appendDashboardLinksToAssistantMessage,
  sanitizeToolError,
  buildUsageRecordFromResponse,
};
