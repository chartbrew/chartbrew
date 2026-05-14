const COMMON_SQL_RULES = [
  "Generate read-only SELECT queries only.",
  "Use explicit columns for chartable results when practical.",
  "Use LIMIT for exploratory/list requests unless the user asks for full aggregation.",
  "Preserve Chartbrew variables exactly, for example {{status}}.",
].join(" ");

const DIALECT_INSTRUCTIONS = {
  postgres: [
    COMMON_SQL_RULES,
    "Use PostgreSQL syntax. Use date_trunc for date buckets and double quotes only when identifiers require quoting.",
  ].join(" "),
  timescaledb: [
    COMMON_SQL_RULES,
    "Use PostgreSQL syntax. Prefer time_bucket for time-series aggregation when the schema supports it; otherwise use date_trunc.",
  ].join(" "),
  supabasedb: [
    COMMON_SQL_RULES,
    "Use PostgreSQL syntax. Respect schema-qualified tables when present.",
  ].join(" "),
  rdsPostgres: [
    COMMON_SQL_RULES,
    "Use PostgreSQL syntax. Avoid extension-specific functions unless the schema makes them obvious.",
  ].join(" "),
  mysql: [
    COMMON_SQL_RULES,
    "Use MySQL syntax. Use DATE_FORMAT or DATE for date buckets and backticks only when identifiers require quoting.",
  ].join(" "),
  rdsMysql: [
    COMMON_SQL_RULES,
    "Use MySQL syntax. Avoid vendor-specific features unless the schema makes them obvious.",
  ].join(" "),
  clickhouse: [
    COMMON_SQL_RULES,
    "Use ClickHouse syntax. Prefer toStartOfDay/toStartOfMonth for date buckets and include LIMIT for exploratory queries.",
  ].join(" "),
  mongodb: [
    "Generate read-only Mongo shell queries only.",
    "Use find for simple filters and aggregate pipelines for grouped or time-series requests.",
    "Return array-shaped results compatible with Chartbrew chart bindings.",
    "Use limit for exploratory/list requests and preserve Chartbrew variables exactly, for example {{status}}.",
  ].join(" "),
};

function getQueryGenerationInstructions(sourceId) {
  return DIALECT_INSTRUCTIONS[sourceId] || COMMON_SQL_RULES;
}

function getQueryGenerationCapabilities(sourceId) {
  return {
    source: sourceId,
    instructions: getQueryGenerationInstructions(sourceId),
    supports: {
      mode: "query_generation",
      readOnly: true,
      chartPlacement: true,
      sourceOwnedPlanning: false,
    },
  };
}

module.exports = {
  getQueryGenerationCapabilities,
  getQueryGenerationInstructions,
};
