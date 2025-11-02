/**
 * Entity Creation Rules for AI Orchestrator
 *
 * Provides structured instructions for creating Chartbrew entities.
 * Edit this file to adjust how the AI creates datasets, charts, etc.
 */

const ENTITY_CREATION_RULES = `## Entity Creation Rules

**Dataset:**
- Required: team_id, connection_id, name, dialect, query, xAxis, yAxis
- Set draft=false (visible), project_ids=[] or [project_id]
- After DataRequest created, update main_dr_id
- xAxis: string - X axis field from query results (use 'root[].field_name' for arrays)
- yAxis: string - Y axis field from query results (use 'root[].field_name' for arrays)
- IMPORTANT: Always use 'root[].' prefix for database query results since they return arrays
- Example: For results like [{"month_start": "2024-01", "count": 5}], use xAxis='root[].month_start', yAxis='root[].count'
- yAxisOperation: string - none, sum, avg, min, max, count (default: none)
- dateField: string - optional date field for filtering
- dateFormat: string - optional date format (e.g. YYYY-MM-DD)
- conditions: array - optional filtering conditions

**Supported Connection Types and Subtypes:**
- MySQL: mysql, rdsMysql
- PostgreSQL: postgres, timescaledb, supabasedb, rdsPostgres
- MongoDB: mongodb

**DataRequest:**
- Required: dataset_id, connection_id, query
- query: string - SQL query for database connections (MySQL, PostgreSQL, MongoDB)
- conditions: array - database filtering conditions (optional)
- configuration: object - dialect-specific settings (optional)
- variables: array - parameterized query variables (default: [])
- transform: object - data transformation rules (optional)

Note: Currently only MySQL, PostgreSQL, and MongoDB connections are supported. API connections will be available in future updates.

**Chart:**
- Required: project_id, dataset_id
- Set draft=false, dashboardOrder=max+1
- name: string - chart name/title (optional)
- legend: string - short legend for data points (separate from chart name, max 20-30 chars)
- type: string - line|bar|pie|doughnut|radar|polar|table|kpi|avg|gauge|matrix
- subType: string - "AddTimeseries" for KPI totals (optional)
- chartSize: integer - 1-4 (size: small to full-width) (default: 2)
- displayLegend: boolean - show legend (default: true)
- pointRadius: integer - 0(hide) >0(show points) (default: 0)
- dataLabels: boolean - show point values (default: false)
- includeZeros: boolean - include zero values (default: true)
- timeInterval: string - second|minute|hour|day|week|month|year (default: "day")
- stacked: boolean - stack bars (bar only) (default: false)
- horizontal: boolean - horizontal bars (bar only) (default: false)
- showGrowth: boolean - percentage growth (default: false)
- invertGrowth: boolean - invert growth calc (default: false)
- mode: string - "chart" or "kpi" (default: "chart")
- maxValue: integer - cap max value (optional)
- minValue: integer - cap min value (optional)
- ranges: array - gauge ranges [{min, max, label, color}] (optional)
- layout: object - grid layout {lg: [x,y,w,h], ...} (optional)

**ChartDatasetConfig:**
- Required: chart_id, dataset_id
- Set legend (short and concise, appears on hover), order=1, datasetColor="#4285F4" (all configurable)
- IMPORTANT: Suggest a separate short legend for ChartDatasetConfig (different from chart name)
- formula: string - transform values (e.g. "{val / 100}", "£{val}") (optional)
- fillColor: string - area/line fill color (optional)
- fill: boolean - enable area fill (default: false)
- multiFill: boolean - multiple fill colors (default: false)
- pointRadius: integer - override point size (default: 0)
- excludedFields: array - exclude from tables (default: [])
- sort: string - "asc"|"desc" for tables (optional)
- columnsOrder: array - custom table columns (optional)
- maxRecords: integer - limit records (optional)
- goal: integer - KPI target value (optional)
- configuration: object - dataset settings (default: {})

**Sequence:**
1. Create Dataset (connection_id, legend, draft=false)
2. Create DataRequest (dataset_id, connection_id, query)
3. Create Chart (project_id, name, type, draft=false)
4. Create ChartDatasetConfig (chart_id, dataset_id, legend)`;

// Supported connection types and their subtypes
const SUPPORTED_CONNECTIONS = {
  mysql: {
    subtypes: ["mysql", "rdsMysql"],
    description: "MySQL database connections including Amazon RDS MySQL"
  },
  postgres: {
    subtypes: ["postgres", "timescaledb", "supabasedb", "rdsPostgres"],
    description: "PostgreSQL database connections including TimescaleDB, Supabase, and Amazon RDS PostgreSQL"
  },
  mongodb: {
    subtypes: ["mongodb"],
    description: "MongoDB NoSQL database connections"
  }
};

// Field definitions for reference and validation
const FIELD_SPECS = {
  Dataset: {
    required: ["team_id", "connection_id", "name", "dialect", "query", "xAxis", "yAxis"],
    recommended: {
      draft: false,
      project_ids: [],
      yAxisOperation: "none",
      dateField: null,
      dateFormat: null,
      conditions: []
    },
    description: "Process and transform data from DataRequests for visualization"
  },

  DataRequest: {
    required: ["dataset_id", "connection_id", "query"],
    recommended: {
      query: null,
      conditions: [],
      configuration: {},
      variables: [],
      transform: null
    },
    description: "Define how to fetch data from supported database connections (MySQL, PostgreSQL, MongoDB)"
  },

  Chart: {
    required: ["project_id", "dataset_id"],
    recommended: {
      draft: false,
      chartSize: 2,
      displayLegend: true,
      includeZeros: true,
      timeInterval: "day",
      pointRadius: 0,
      dataLabels: false,
      stacked: false,
      horizontal: false,
      showGrowth: false,
      invertGrowth: false,
      mode: "chart",
      legend: null // Short legend for ChartDatasetConfig
    },
    conditionalFields: {
      bar: ["stacked", "horizontal"],
      kpi: ["subType"] // Use "AddTimeseries" for accumulating totals
    },
    description: "Visual representations of Datasets, placed in Projects (dashboards)"
  },

  ChartDatasetConfig: {
    required: ["chart_id", "dataset_id"],
    recommended: {
      legend: null, // Use dataset name or chart title
      order: 1,
      datasetColor: "#4285F4",
      fill: false,
      multiFill: false,
      pointRadius: 0,
      excludedFields: [],
      configuration: {}
    },
    description: "Link Charts to Datasets with specific configurations"
  }
};

// Common field defaults
const DEFAULTS = {
  chartColors: [
    "#4285F4", "#FF9800", "#26A69A", "#D602EE", "#C0CA33",
    "#9C27B0", "#EE6002", "#C8A1FF", "#43A047", "#D81B60"
  ],
  chartSize: 2,
  timeIntervals: ["second", "minute", "hour", "day", "week", "month", "year"],
  chartTypes: {
    line: "trends over time, time series data",
    bar: "comparing values across categories",
    pie: "proportions of a whole",
    doughnut: "proportions with emphasis on total",
    kpi: "single value metrics",
    avg: "average value metrics",
    table: "tabular data display",
    gauge: "indicator within a range"
  }
};
// Helper functions for future validation/enhancement

/**
 * Get the creation rules text (for injecting into system prompt)
 */
function getCreationRules() {
  return ENTITY_CREATION_RULES;
}

/**
 * Get required fields for an entity type
 * @param {string} entityType - "Dataset", "DataRequest", "Chart", or "ChartDatasetConfig"
 * @returns {Array<string>} Required field names
 */
function getRequiredFields(entityType) {
  return FIELD_SPECS[entityType]?.required || [];
}

/**
 * Get recommended defaults for an entity type
 * @param {string} entityType - Entity type name
 * @returns {Object} Recommended field values
 */
function getRecommendedDefaults(entityType) {
  return FIELD_SPECS[entityType]?.recommended || {};
}

/**
 * Check if a connection type and subtype is supported
 * @param {string} type - Connection type (e.g., "mysql", "postgres", "mongodb")
 * @param {string} subType - Connection subtype (optional)
 * @returns {boolean} Whether the connection type is supported
 */
function isConnectionSupported(type, subType) {
  const connectionType = SUPPORTED_CONNECTIONS[type];
  if (!connectionType) return false;

  if (subType) {
    return connectionType.subtypes.includes(subType);
  }

  return true;
}

/**
 * Validate entity payload (for future use in API validation)
 * @param {string} entityType - Entity type name
 * @param {Object} payload - Entity data to validate
 * @returns {Object} { valid: boolean, missing: string[], warnings: string[] }
 */
function validateEntityPayload(entityType, payload) {
  const spec = FIELD_SPECS[entityType];
  if (!spec) {
    return { valid: false, missing: ["Unknown entity type"], warnings: [] };
  }

  const missing = spec.required.filter((field) => !payload[field]);
  const warnings = [];

  // Check recommended fields
  Object.entries(spec.recommended).forEach(([field, defaultValue]) => {
    if (payload[field] === undefined && defaultValue !== null) {
      warnings.push(`Recommended field "${field}" not set (default: ${defaultValue})`);
    }
  });

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

module.exports = {
  ENTITY_CREATION_RULES,
  FIELD_SPECS,
  DEFAULTS,
  SUPPORTED_CONNECTIONS,
  // Helper functions
  getCreationRules,
  getRequiredFields,
  getRecommendedDefaults,
  isConnectionSupported,
  validateEntityPayload
};
