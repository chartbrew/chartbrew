const googleAnalyticsConnection = require("../googleAnalytics.connection");
const googleAnalyticsProtocol = require("../googleAnalytics.protocol");

const SOURCE_ID = "googleAnalytics";

const DEFAULT_CONFIGURATION = {
  accountId: "",
  propertyId: "",
  startDate: "30daysAgo",
  endDate: "yesterday",
  metrics: "activeUsers",
  dimensions: "date",
};

const SOURCE_INSTRUCTIONS = [
  "Google Analytics is configuration-based. Return DataRequest.configuration objects; do not generate SQL or invent API routes.",
  "Chartbrew's current GA4 runner supports one metric and one optional dimension per report.",
  "Use GA4 API names such as activeUsers, sessions, screenPageViews, date, sessionDefaultChannelGroup, pagePath, and country.",
  "Use source_plan_dataset for GA4 questions, then create_temporary_chart by default unless the user explicitly names a dashboard.",
  "If the user names a site, brand, property, property ID, or quick-reply label, choose the matching GA4 property instead of asking again.",
  "Only ask the user to choose a GA4 property when multiple properties remain equally plausible after matching the request text.",
].join("\n");

const COMMON_METRICS = [
  {
    apiName: "activeUsers",
    label: "Active users",
    aliases: ["active users", "users", "visitors", "traffic"],
  },
  {
    apiName: "newUsers",
    label: "New users",
    aliases: ["new users", "first time users", "new visitors"],
  },
  {
    apiName: "sessions",
    label: "Sessions",
    aliases: ["sessions", "visits"],
  },
  {
    apiName: "screenPageViews",
    label: "Views",
    aliases: ["page views", "views", "screen views", "pageviews"],
  },
  {
    apiName: "eventCount",
    label: "Event count",
    aliases: ["events", "event count"],
  },
  {
    apiName: "engagementRate",
    label: "Engagement rate",
    aliases: ["engagement rate"],
  },
];

const COMMON_DIMENSIONS = [
  {
    apiName: "date",
    label: "Date",
    aliases: ["over time", "trend", "daily", "by day", "per day", "by date"],
    chartType: "line",
  },
  {
    apiName: "sessionDefaultChannelGroup",
    label: "Session default channel group",
    aliases: ["by channel", "channel", "traffic channel", "marketing channel"],
    chartType: "bar",
  },
  {
    apiName: "pagePath",
    label: "Page path",
    aliases: ["by page", "page path", "url", "path"],
    chartType: "bar",
  },
  {
    apiName: "pageTitle",
    label: "Page title",
    aliases: ["by page title", "page title"],
    chartType: "bar",
  },
  {
    apiName: "country",
    label: "Country",
    aliases: ["by country", "country"],
    chartType: "bar",
  },
  {
    apiName: "deviceCategory",
    label: "Device category",
    aliases: ["by device", "device", "device category"],
    chartType: "bar",
  },
  {
    apiName: "sessionSourceMedium",
    label: "Session source / medium",
    aliases: ["source medium", "by source", "by medium"],
    chartType: "bar",
  },
  {
    apiName: "campaignName",
    label: "Campaign",
    aliases: ["by campaign", "campaign"],
    chartType: "bar",
  },
];

const VALID_DATE_PATTERN = /^(today|yesterday|\d+daysAgo|\d{4}-\d{2}-\d{2})$/;

function normalizeText(value = "") {
  return String(value).toLowerCase();
}

function normalizeSearchText(value = "") {
  return normalizeText(value)
    .replace(/properties\/(\d+)/g, "properties $1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getSearchTokens(value = "") {
  const ignoredTokens = new Set([
    "a",
    "an",
    "and",
    "for",
    "ga4",
    "google",
    "analytics",
    "property",
    "the",
    "use",
    "web",
    "website",
  ]);

  return normalizeSearchText(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !ignoredTokens.has(token));
}

function fieldListByApiName(fields = []) {
  return new Map(fields.map((field) => [field.apiName, field]));
}

function getMetadataFields(metadata, type) {
  if (!metadata) return [];
  const fields = metadata[type];
  return Array.isArray(fields) ? fields : [];
}

function flattenProperties(accounts = []) {
  return accounts.flatMap((account) => {
    return (account.propertySummaries || []).map((property) => ({
      accountId: account.account,
      accountName: account.displayName,
      propertyId: property.property,
      propertyName: property.displayName,
    }));
  });
}

function getPropertySearchValues(property) {
  return [
    property.propertyId,
    property.propertyId?.replace(/^properties\//, ""),
    property.propertyName,
    property.accountName,
    [property.accountName, property.propertyName].filter(Boolean).join(" / "),
    [property.accountName, property.propertyName].filter(Boolean).join(" "),
  ].filter(Boolean);
}

function scorePropertyMatch(property, question = "") {
  const normalizedQuestion = normalizeSearchText(question);
  const values = getPropertySearchValues(property);

  if (!normalizedQuestion) return 0;

  if (values.some((value) => normalizedQuestion.includes(normalizeSearchText(value)))) {
    return 100;
  }

  const bestTokenScore = values.reduce((bestScore, value) => {
    const tokens = getSearchTokens(value);
    if (tokens.length === 0) return bestScore;

    const matchedTokens = tokens.filter((token) => normalizedQuestion.includes(token));
    if (matchedTokens.length === 0) return bestScore;

    const score = matchedTokens.length / tokens.length;
    return Math.max(bestScore, score);
  }, 0);

  return bestTokenScore >= 0.75 ? Math.round(bestTokenScore * 90) : 0;
}

function findPropertyFromQuestion(properties = [], question = "") {
  const matches = properties
    .map((property) => ({
      property,
      score: scorePropertyMatch(property, question),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0].property;
  if (matches[0].score > matches[1].score) return matches[0].property;

  return null;
}

async function getAccounts(connection) {
  if (!connection?.oauth_id && !connection?.id) return [];

  try {
    const metadata = await googleAnalyticsProtocol.getBuilderMetadata({ connection });
    return metadata.accounts || [];
  } catch {
    return [];
  }
}

async function resolveProperty({ connection, overrides = {}, question = "" } = {}) {
  if (overrides.propertyId) {
    return {
      status: "ok",
      accountId: overrides.accountId || "",
      propertyId: overrides.propertyId,
      propertyName: overrides.propertyName || "",
    };
  }

  const schemaProperty = connection?.schema?.googleAnalytics?.propertyId
    || connection?.schema?.propertyId
    || connection?.options?.googleAnalytics?.propertyId;

  if (schemaProperty) {
    return {
      status: "ok",
      accountId: connection?.schema?.googleAnalytics?.accountId || connection?.schema?.accountId || "",
      propertyId: schemaProperty,
      propertyName: connection?.schema?.googleAnalytics?.propertyName || "",
    };
  }

  const accounts = await getAccounts(connection);
  const properties = flattenProperties(accounts);
  const matchedProperty = findPropertyFromQuestion(properties, question);

  if (matchedProperty) {
    return {
      status: "ok",
      ...matchedProperty,
    };
  }

  if (properties.length === 1) {
    return {
      status: "ok",
      ...properties[0],
    };
  }

  if (properties.length > 1) {
    return {
      status: "needs_disambiguation",
      message: "Choose a Google Analytics property before I build this report.",
      options: properties.map((property) => ({
        label: [property.accountName, property.propertyName].filter(Boolean).join(" / ") || property.propertyId,
        value: property.propertyId,
        accountId: property.accountId,
      })),
    };
  }

  return {
    status: "needs_more_context",
    message: "I need a Google Analytics property before I can build this report.",
    requiredContext: ["propertyId"],
  };
}

function resolveMetric(question = "", metadata = null) {
  const normalizedQuestion = normalizeText(question);
  const metadataMetrics = fieldListByApiName(getMetadataFields(metadata, "metrics"));

  const exactMetadataMetric = getMetadataFields(metadata, "metrics").find((metric) => {
    return normalizedQuestion.includes(normalizeText(metric.apiName))
      || normalizedQuestion.includes(normalizeText(metric.uiName));
  });
  if (exactMetadataMetric) {
    return exactMetadataMetric.apiName;
  }

  const metric = COMMON_METRICS.find((candidate) => {
    return candidate.aliases.some((alias) => normalizedQuestion.includes(alias));
  });
  if (metric) return metric.apiName;

  if (normalizedQuestion.includes("conversion") || normalizedQuestion.includes("key event")) {
    if (metadataMetrics.has("keyEvents")) return "keyEvents";
    if (metadataMetrics.has("conversions")) return "conversions";
    return null;
  }

  return "activeUsers";
}

function resolveDimension(question = "") {
  const normalizedQuestion = normalizeText(question);

  if (
    normalizedQuestion.includes("kpi")
    || normalizedQuestion.includes("total")
    || normalizedQuestion.includes("how many")
  ) {
    return "";
  }

  const dimension = COMMON_DIMENSIONS.find((candidate) => {
    return candidate.aliases.some((alias) => normalizedQuestion.includes(alias));
  });

  return dimension?.apiName || "date";
}

function resolveDateRange(question = "", overrides = {}) {
  if (overrides.startDate || overrides.endDate) {
    return {
      startDate: overrides.startDate || DEFAULT_CONFIGURATION.startDate,
      endDate: overrides.endDate || DEFAULT_CONFIGURATION.endDate,
    };
  }

  const normalizedQuestion = normalizeText(question);
  const daysMatch = normalizedQuestion.match(/last\s+(\d+)\s+days?/);
  if (daysMatch) {
    return {
      startDate: `${daysMatch[1]}daysAgo`,
      endDate: normalizedQuestion.includes("today") ? "today" : "yesterday",
    };
  }

  if (normalizedQuestion.includes("today")) {
    return { startDate: "today", endDate: "today" };
  }

  if (normalizedQuestion.includes("yesterday")) {
    return { startDate: "yesterday", endDate: "yesterday" };
  }

  return {
    startDate: DEFAULT_CONFIGURATION.startDate,
    endDate: DEFAULT_CONFIGURATION.endDate,
  };
}

function findMetricLabel(metricName) {
  return COMMON_METRICS.find((metric) => metric.apiName === metricName)?.label || metricName;
}

function getChartSpec(configuration) {
  const metric = configuration.metrics;
  const dimension = configuration.dimensions;
  const dimensionMeta = COMMON_DIMENSIONS.find((candidate) => candidate.apiName === dimension);
  const isDateDimension = ["date", "dateHour", "dateHourMinute"].includes(dimension);

  if (!dimension) {
    return {
      type: "kpi",
      title: findMetricLabel(metric),
      yAxis: `root[].${metric}`,
      yAxisOperation: "none",
      legend: findMetricLabel(metric),
    };
  }

  return {
    type: dimensionMeta?.chartType || (isDateDimension ? "line" : "bar"),
    title: `${findMetricLabel(metric)} by ${dimensionMeta?.label || dimension}`,
    xAxis: `root[].${dimension}`,
    yAxis: `root[].${metric}`,
    yAxisOperation: "none",
    dateField: isDateDimension ? `root[].${dimension}` : undefined,
    timeInterval: dimension === "date" ? "day" : undefined,
    xLabelTicks: isDateDimension ? "default" : "showAll",
    horizontal: dimension === "pagePath" || dimension === "pageTitle",
    legend: findMetricLabel(metric),
  };
}

function getOutputFields(configuration) {
  return [
    configuration.dimensions ? `root[].${configuration.dimensions}` : null,
    `root[].${configuration.metrics}`,
  ].filter(Boolean);
}

function validateField({ name, type, metadata }) {
  const commonFields = type === "metrics" ? COMMON_METRICS : COMMON_DIMENSIONS;
  const metadataFields = getMetadataFields(metadata, type);

  return commonFields.some((field) => field.apiName === name)
    || metadataFields.some((field) => field.apiName === name);
}

function validateConfiguration(configuration = {}, { metadata = null } = {}) {
  const errors = [];
  const warnings = [];
  const normalized = {
    ...DEFAULT_CONFIGURATION,
    ...configuration,
  };

  if (!normalized.propertyId) errors.push("Google Analytics propertyId is required.");
  if (!normalized.metrics) errors.push("Google Analytics metrics is required.");
  if (!VALID_DATE_PATTERN.test(normalized.startDate)) {
    errors.push(`Unsupported GA4 startDate: ${normalized.startDate}`);
  }
  if (!VALID_DATE_PATTERN.test(normalized.endDate)) {
    errors.push(`Unsupported GA4 endDate: ${normalized.endDate}`);
  }
  if (normalized.metrics && !validateField({ name: normalized.metrics, type: "metrics", metadata })) {
    errors.push(`Unsupported GA4 metric: ${normalized.metrics}`);
  }
  if (normalized.dimensions && !validateField({ name: normalized.dimensions, type: "dimensions", metadata })) {
    errors.push(`Unsupported GA4 dimension: ${normalized.dimensions}`);
  }

  if (!metadata) {
    warnings.push("Validation used Chartbrew's compact GA4 field map. Property metadata can provide additional fields.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    configuration: normalized,
  };
}

async function getPropertyMetadata(connection, propertyId) {
  if (!connection || !propertyId) return null;

  try {
    const metadata = await googleAnalyticsProtocol.getBuilderMetadata({
      connection,
      options: { propertyId },
    });
    return metadata.metadata || null;
  } catch {
    return null;
  }
}

function getCapabilities() {
  return {
    source: SOURCE_ID,
    instructions: SOURCE_INSTRUCTIONS,
    supports: {
      mode: "runReport",
      metricsPerRequest: 1,
      dimensionsPerRequest: 1,
      variables: false,
      templates: [],
      chartPlacement: true,
    },
    commonMetrics: COMMON_METRICS.map(({ apiName, label }) => ({ apiName, label })),
    commonDimensions: COMMON_DIMENSIONS.map(({ apiName, label }) => ({ apiName, label })),
    caveats: [
      "The current Chartbrew GA4 runner supports one metric and one optional dimension per report.",
      "Property-specific metric and dimension compatibility should be checked through metadata when available.",
    ],
  };
}

async function listResources({ connection } = {}) {
  const accounts = await getAccounts(connection);

  return {
    source: SOURCE_ID,
    accounts: accounts.map((account) => ({
      account: account.account,
      displayName: account.displayName,
      properties: (account.propertySummaries || []).map((property) => ({
        property: property.property,
        displayName: property.displayName,
      })),
    })),
    metrics: COMMON_METRICS.map(({ apiName, label }) => ({ apiName, label })),
    dimensions: COMMON_DIMENSIONS.map(({ apiName, label }) => ({ apiName, label })),
  };
}

async function getSchema({ connection, propertyId } = {}) {
  const metadata = await getPropertyMetadata(connection, propertyId);
  const metrics = metadata ? getMetadataFields(metadata, "metrics") : COMMON_METRICS;
  const dimensions = metadata ? getMetadataFields(metadata, "dimensions") : COMMON_DIMENSIONS;

  return {
    source: SOURCE_ID,
    entities: [{
      name: "ga4_report",
      kind: "google_analytics_report",
      metrics: metrics.map((metric) => ({
        name: metric.apiName,
        label: metric.uiName || metric.label || metric.apiName,
      })),
      dimensions: dimensions.map((dimension) => ({
        name: dimension.apiName,
        label: dimension.uiName || dimension.label || dimension.apiName,
      })),
      columns: [
        ...dimensions.map((dimension) => ({
          name: dimension.apiName,
          type: dimension.apiName?.startsWith("date") ? "date" : "string",
        })),
        ...metrics.map((metric) => ({
          name: metric.apiName,
          type: "number",
        })),
      ],
    }],
  };
}

function getTemplates() {
  return {
    source: SOURCE_ID,
    templates: [],
  };
}

function recommendTemplates({ question = "" } = {}) {
  return {
    source: SOURCE_ID,
    question,
    recommendations: [],
  };
}

async function planDataset({ connection, question = "", overrides = {} } = {}) {
  const property = await resolveProperty({ connection, overrides, question });
  if (property.status !== "ok") {
    return {
      status: property.status,
      source: SOURCE_ID,
      message: property.message,
      options: property.options || [],
      requiredContext: property.requiredContext || [],
      warnings: [],
      errors: [],
    };
  }

  const metadata = await getPropertyMetadata(connection, property.propertyId);
  const metric = overrides.metrics || resolveMetric(question, metadata);
  if (!metric) {
    return {
      status: "needs_more_context",
      source: SOURCE_ID,
      message: "I need the GA4 metric name before I can build this report.",
      requiredContext: ["metrics"],
      warnings: [],
      errors: [],
    };
  }

  const dimension = overrides.dimensions !== undefined ? overrides.dimensions : resolveDimension(question);
  const dateRange = resolveDateRange(question, overrides);
  const configuration = {
    accountId: property.accountId || overrides.accountId || "",
    propertyId: property.propertyId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    metrics: metric,
    dimensions: dimension || undefined,
  };
  const validation = validateConfiguration(configuration, { metadata });
  const chartSpec = getChartSpec(validation.configuration);

  return {
    status: validation.valid ? "ok" : "invalid",
    source: SOURCE_ID,
    datasetName: chartSpec.title,
    configuration: validation.configuration,
    chartSpec,
    outputFields: getOutputFields(validation.configuration),
    warnings: validation.warnings,
    errors: validation.errors,
    rationale: {
      metric,
      dimension,
      propertyId: property.propertyId,
    },
  };
}

async function previewConfiguration({ connection, configuration, rowLimit = 25 } = {}) {
  const metadata = await getPropertyMetadata(connection, configuration?.propertyId);
  const validation = validateConfiguration(configuration, { metadata });
  if (!validation.valid) {
    return {
      status: "invalid",
      ...validation,
    };
  }

  const savedConnection = await googleAnalyticsProtocol.getSavedConnection(connection);
  const oauth = await googleAnalyticsProtocol.getOAuth(savedConnection);
  const dataRequest = {
    id: null,
    configuration: validation.configuration,
  };
  const rows = await googleAnalyticsConnection.getAnalytics(oauth, dataRequest);
  const limitedRows = rows.slice(0, rowLimit);
  const columns = limitedRows[0]
    ? Object.keys(limitedRows[0]).map((name) => ({ name, type: typeof limitedRows[0][name] }))
    : getOutputFields(validation.configuration).map((field) => ({
      name: field.replace("root[].", ""),
      type: field.includes(validation.configuration.metrics) ? "number" : "string",
    }));

  return {
    status: "ok",
    rows: limitedRows,
    columns,
    rowCount: rows.length,
    warnings: validation.warnings,
    chartSpec: getChartSpec(validation.configuration),
  };
}

async function getSampleData({ connection, rowLimit = 5 } = {}) {
  const plan = await planDataset({
    connection,
    question: "active users over time",
    overrides: { startDate: "7daysAgo", endDate: "yesterday" },
  });
  if (plan.status !== "ok") return plan;

  return previewConfiguration({
    connection,
    configuration: plan.configuration,
    rowLimit,
  });
}

module.exports = {
  getCapabilities,
  getSampleData,
  getSchema,
  instructions: SOURCE_INSTRUCTIONS,
  listResources,
  listTemplates: getTemplates,
  planDataset,
  previewConfiguration,
  recommendTemplates,
  validateConfiguration,
};
