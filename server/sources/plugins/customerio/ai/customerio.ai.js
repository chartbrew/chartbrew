const CustomerioConnection = require("../customerio.connection");

const SOURCE_ID = "customerio";

const SOURCE_INSTRUCTIONS = [
  "Customer.io uses source-owned DataRequest routes. Return method, route, itemsLimit, and configuration; do not generate SQL.",
  "Only plan routes supported by Chartbrew: customers, activities, and campaign metric routes.",
  "For customers, use POST customers with optional configuration.cioFilters and populateAttributes.",
  "For activities, use GET activities with activityType, eventName, customerId, idType, deleted, and limit.",
  "For campaign metrics, resolve a campaign by ID or name from Customer.io before creating campaign metric routes.",
  "Ask for missing context instead of inventing unsupported Customer.io routes, campaign IDs, event names, or filter fields.",
].join("\n");

const CUSTOMER_FILTER_OPERATORS = new Set(["eq", "exists"]);
const MESSAGE_SERIES = [
  "delivered",
  "opened",
  "clicked",
  "converted",
  "attempted",
  "bounced",
  "dropped",
  "failed",
  "sent",
  "spammed",
  "undeliverable",
  "unsubscribed",
];
const JOURNEY_SERIES = [
  "started",
  "activated",
  "exited_early",
  "finished",
  "converted",
  "never_activated",
  "messaged",
];
const MESSAGE_CHANNELS = ["email", "webhook", "twilio", "slack", "push", "urban_airship"];
const ACTIVITY_TYPES = [
  "event",
  "failed_event",
  "page",
  "screen",
  "profile_create",
  "attribute_change",
  "sent_email",
  "delivered_email",
  "opened_email",
  "clicked_email",
  "converted_email",
  "bounced_email",
  "failed_email",
  "unsubscribed_email",
  "sent_push",
  "opened_push",
  "clicked_push",
  "sent_slack",
  "converted_slack",
  "sent_twilio",
  "clicked_twilio",
  "webhook_event",
];

function normalizeText(value = "") {
  return String(value).toLowerCase();
}

function normalizeSearchText(value = "") {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value = "") {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`);
}

function getQuestionTokens(question = "") {
  const ignoredTokens = new Set([
    "a",
    "all",
    "and",
    "chart",
    "count",
    "customer",
    "customers",
    "event",
    "events",
    "for",
    "from",
    "io",
    "last",
    "list",
    "metric",
    "metrics",
    "my",
    "of",
    "people",
    "show",
    "the",
    "total",
    "user",
    "users",
    "with",
  ]);

  return normalizeSearchText(question)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !ignoredTokens.has(token));
}

function isCountRequest(question = "") {
  const normalizedQuestion = normalizeText(question);
  return normalizedQuestion.includes("count")
    || normalizedQuestion.includes("how many")
    || normalizedQuestion.includes("total")
    || normalizedQuestion.includes("kpi");
}

function parseLimit(question = "", fallback = 100) {
  const normalizedQuestion = normalizeText(question);
  const limitMatch = normalizedQuestion.match(/(?:limit|top|first|last)\s+(\d+)/);
  if (!limitMatch) return fallback;

  return Math.max(1, Math.min(parseInt(limitMatch[1], 10), 500));
}

function parsePeriod(question = "") {
  const normalizedQuestion = normalizeText(question);
  const units = [
    { token: "hour", period: "hours", max: 24 },
    { token: "day", period: "days", max: 45 },
    { token: "week", period: "weeks", max: 12 },
    { token: "month", period: "months", max: 12 },
  ];
  const matchedUnit = units.find((unit) => normalizedQuestion.includes(unit.token));
  const daysMatch = normalizedQuestion.match(/last\s+(\d+)\s+(hour|hours|day|days|week|weeks|month|months)/);

  if (daysMatch) {
    const unit = units.find((candidate) => daysMatch[2].startsWith(candidate.token));
    return {
      period: unit.period,
      steps: Math.max(1, Math.min(parseInt(daysMatch[1], 10), unit.max)),
    };
  }

  if (matchedUnit) {
    return {
      period: matchedUnit.period,
      steps: matchedUnit.period === "hours" ? 24 : 30,
    };
  }

  return {
    period: "days",
    steps: 30,
  };
}

function scoreNamedResource(resource, question = "", fields = ["name", "id"]) {
  const normalizedQuestion = normalizeSearchText(question);
  if (!normalizedQuestion) return 0;

  const values = fields
    .map((field) => resource[field])
    .filter(Boolean);

  if (values.some((value) => normalizedQuestion.includes(normalizeSearchText(value)))) {
    return 100;
  }

  const questionTokens = new Set(getQuestionTokens(question));
  return values.reduce((bestScore, value) => {
    const tokens = getQuestionTokens(value);
    if (tokens.length === 0) return bestScore;
    const matchedTokens = tokens.filter((token) => questionTokens.has(token));
    const score = matchedTokens.length / tokens.length;
    return Math.max(bestScore, score >= 0.75 ? Math.round(score * 90) : 0);
  }, 0);
}

function findBestResource(resources = [], question = "", fields = ["name", "id"]) {
  const matches = resources
    .map((resource) => ({
      resource,
      score: scoreNamedResource(resource, question, fields),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0].resource;
  if (matches[0].score > matches[1].score) return matches[0].resource;

  return null;
}

async function safeListCampaigns(connection) {
  try {
    const campaigns = await CustomerioConnection.getAllCampaigns(connection);
    return Array.isArray(campaigns) ? campaigns : [];
  } catch {
    return [];
  }
}

async function safeListSegments(connection) {
  try {
    const segments = await CustomerioConnection.getAllSegments(connection);
    return Array.isArray(segments) ? segments : [];
  } catch {
    return [];
  }
}

async function safeListObjectTypes(connection) {
  try {
    const types = await CustomerioConnection.getAllObjectTypes(connection);
    return Array.isArray(types) ? types : [];
  } catch {
    return [];
  }
}

async function resolveSegmentFilter(connection, question = "") {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion.includes("segment")) return null;

  const segments = await safeListSegments(connection);
  const segment = findBestResource(segments, question, ["name", "id"]);

  if (!segment && segments.length > 0) {
    return {
      status: "needs_disambiguation",
      message: "Choose a Customer.io segment before I build this customer report.",
      options: segments.slice(0, 10).map((candidate) => ({
        label: candidate.name || `${candidate.id}`,
        value: `${candidate.id}`,
      })),
    };
  }

  if (!segment) return null;

  return {
    condition: {
      segment: {
        id: segment.id,
      },
    },
    label: segment.name || `${segment.id}`,
  };
}

function parseAttributeFilter(question = "") {
  const patterns = [
    /(?:where|with|whose)\s+([a-zA-Z0-9_.$-]+)\s+(?:is|equals|=)\s+["']?([^"',\n]+)["']?/i,
    /attribute\s+([a-zA-Z0-9_.$-]+)\s+(?:is|equals|=)\s+["']?([^"',\n]+)["']?/i,
  ];
  const match = patterns
    .map((pattern) => question.match(pattern))
    .find(Boolean);

  if (!match) return null;

  return {
    attribute: {
      field: match[1],
      operator: "eq",
      value: match[2].trim(),
    },
  };
}

function resolveCustomerChartSpec({ question = "", filterLabel = "" } = {}) {
  if (isCountRequest(question)) {
    return {
      type: "kpi",
      title: filterLabel ? `${filterLabel} customers` : "Customers",
      yAxis: "root.customer_count",
      yAxisOperation: "none",
      legend: "Customers",
    };
  }

  return {
    type: "table",
    title: filterLabel ? `${filterLabel} customers` : "Customer list",
    columnsOrder: ["id", "email", "cio_id", "created_at"],
    maxRecords: 100,
  };
}

async function planCustomers({ connection, question = "" } = {}) {
  const segmentFilter = await resolveSegmentFilter(connection, question);
  if (segmentFilter?.status) return segmentFilter;

  const attributeFilter = parseAttributeFilter(question);
  const conditions = [
    segmentFilter?.condition,
    attributeFilter,
  ].filter(Boolean);
  const configuration = {
    populateAttributes: !isCountRequest(question),
    ...(conditions.length > 0 ? { cioFilters: { and: conditions } } : {}),
  };
  const chartSpec = resolveCustomerChartSpec({
    question,
    filterLabel: segmentFilter?.label || attributeFilter?.attribute?.value,
  });

  return buildPlan({
    datasetName: chartSpec.title,
    method: "POST",
    route: "customers",
    itemsLimit: parseLimit(question),
    configuration,
    chartSpec,
    outputFields: chartSpec.type === "kpi"
      ? ["root.customer_count"]
      : ["root.customers[].id", "root.customers[].email", "root.customers[].cio_id"],
    rationale: {
      intent: "customers",
    },
  });
}

function resolveActivityType(question = "") {
  const normalizedQuestion = normalizeText(question);
  const directMatch = ACTIVITY_TYPES.find((type) => normalizedQuestion.includes(type));
  if (directMatch) return directMatch;

  if (normalizedQuestion.includes("failed event")) return "failed_event";
  if (normalizedQuestion.includes("event")) return "event";
  if (normalizedQuestion.includes("page")) return "page";
  if (normalizedQuestion.includes("screen")) return "screen";
  if (normalizedQuestion.includes("open") && normalizedQuestion.includes("email")) return "opened_email";
  if (normalizedQuestion.includes("click") && normalizedQuestion.includes("email")) return "clicked_email";
  if (normalizedQuestion.includes("deliver") && normalizedQuestion.includes("email")) return "delivered_email";
  if (normalizedQuestion.includes("bounce") && normalizedQuestion.includes("email")) return "bounced_email";
  if (normalizedQuestion.includes("unsubscribe") && normalizedQuestion.includes("email")) return "unsubscribed_email";
  if (normalizedQuestion.includes("sent") && normalizedQuestion.includes("email")) return "sent_email";
  if (normalizedQuestion.includes("push") && normalizedQuestion.includes("open")) return "opened_push";
  if (normalizedQuestion.includes("webhook")) return "webhook_event";

  return undefined;
}

function resolveEventName(question = "") {
  const quoted = question.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1];

  const namedMatch = question.match(/(?:event named|event called|event name)\s+([a-zA-Z0-9_.$:-]+)/i);
  if (namedMatch) return namedMatch[1];

  const normalizedQuestion = normalizeSearchText(question);
  const eventPhrase = normalizedQuestion.match(/([a-z0-9_.$:-]+)\s+events?/);
  const reserved = new Set(["recent", "latest", "customer", "customers", "failed", "email"]);
  if (eventPhrase && !reserved.has(eventPhrase[1])) return eventPhrase[1];

  return undefined;
}

function resolveActivityChartSpec({ question = "", activityType = "" } = {}) {
  if (isCountRequest(question)) {
    return {
      type: "kpi",
      title: `${titleCase(activityType || "Activity")} count`,
      yAxis: "root.activity_count",
      yAxisOperation: "none",
      legend: "Activities",
    };
  }

  return {
    type: "table",
    title: `${titleCase(activityType || "Recent activities")}`,
    columnsOrder: ["id", "type", "name", "customer_id", "created_at"],
    maxRecords: 100,
  };
}

function planActivities({ question = "" } = {}) {
  const activityType = resolveActivityType(question);
  const eventName = resolveEventName(question);
  const configuration = {
    limit: parseLimit(question),
    ...(activityType ? { activityType } : {}),
    ...(eventName ? { eventName } : {}),
  };
  const chartSpec = resolveActivityChartSpec({ question, activityType });

  return buildPlan({
    datasetName: chartSpec.title,
    method: "GET",
    route: "activities",
    itemsLimit: configuration.limit,
    configuration,
    chartSpec,
    outputFields: chartSpec.type === "kpi"
      ? ["root.activity_count"]
      : ["root.activities[].id", "root.activities[].type", "root.activities[].name"],
    rationale: {
      intent: "activities",
      activityType,
      eventName,
    },
  });
}

function resolveCampaignSeries(question = "", route = "metrics") {
  const normalizedQuestion = normalizeText(question);
  const series = route === "journey_metrics" ? JOURNEY_SERIES : MESSAGE_SERIES;
  const directMatch = series.find((candidate) => normalizedQuestion.includes(candidate.replace("_", " ")));
  if (directMatch) return directMatch;

  if (normalizedQuestion.includes("open")) return "opened";
  if (normalizedQuestion.includes("click")) return "clicked";
  if (normalizedQuestion.includes("convert")) return "converted";
  if (normalizedQuestion.includes("bounce")) return "bounced";
  if (normalizedQuestion.includes("unsubscribe")) return "unsubscribed";
  if (normalizedQuestion.includes("finish")) return "finished";
  if (normalizedQuestion.includes("start")) return "started";
  if (normalizedQuestion.includes("sent")) return "sent";

  return route === "journey_metrics" ? "started" : "delivered";
}

function resolveCampaignRoute(question = "") {
  const normalizedQuestion = normalizeText(question);
  if (normalizedQuestion.includes("journey")) return "journey_metrics";
  return "metrics";
}

function resolveCampaignChannels(question = "") {
  const normalizedQuestion = normalizeText(question);
  return MESSAGE_CHANNELS.filter((channel) => {
    return normalizedQuestion.includes(channel.replace("_", " "))
      || normalizedQuestion.includes(channel);
  });
}

async function planCampaignMetrics({ connection, question = "" } = {}) {
  const campaigns = await safeListCampaigns(connection);
  const campaign = findBestResource(campaigns, question, ["name", "id"]);

  if (!campaign) {
    return {
      status: campaigns.length > 0 ? "needs_disambiguation" : "needs_more_context",
      source: SOURCE_ID,
      message: campaigns.length > 0
        ? "Choose a Customer.io campaign before I build this campaign metric."
        : "I need a Customer.io campaign ID or name before I can build campaign metrics.",
      options: campaigns.slice(0, 10).map((candidate) => ({
        label: candidate.name || `${candidate.id}`,
        value: `${candidate.id}`,
      })),
      warnings: [],
      errors: [],
    };
  }

  const requestRoute = resolveCampaignRoute(question);
  const series = resolveCampaignSeries(question, requestRoute);
  const period = parsePeriod(question);
  const channels = resolveCampaignChannels(question);
  const configuration = {
    campaignId: campaign.id,
    requestRoute,
    period: period.period,
    steps: period.steps,
    series,
    ...(channels.length > 0 ? { type: channels } : {}),
  };
  const route = `campaigns/${campaign.id}/${requestRoute}`;
  const chartSpec = {
    type: "line",
    title: `${titleCase(series)} for ${campaign.name || campaign.id}`,
    xAxis: `root.${series}[].date`,
    yAxis: `root.${series}[].value`,
    yAxisOperation: "none",
    dateField: `root.${series}[].date`,
    timeInterval: period.period === "hours" ? "hour" : period.period.replace(/s$/, ""),
    legend: titleCase(series),
  };

  return buildPlan({
    datasetName: chartSpec.title,
    method: "GET",
    route,
    itemsLimit: 100,
    configuration,
    chartSpec,
    outputFields: [`root.${series}[].date`, `root.${series}[].value`],
    rationale: {
      intent: "campaign_metrics",
      campaignId: campaign.id,
      series,
    },
  });
}

function detectIntent(question = "") {
  const normalizedQuestion = normalizeText(question);
  if (normalizedQuestion.includes("campaign") || normalizedQuestion.includes("newsletter")) {
    return "campaigns";
  }
  if (
    normalizedQuestion.includes("activit")
    || normalizedQuestion.includes("event")
    || normalizedQuestion.includes("email open")
    || normalizedQuestion.includes("email click")
  ) {
    return "activities";
  }
  return "customers";
}

function buildPlan({
  datasetName,
  method,
  route,
  itemsLimit,
  configuration,
  chartSpec,
  outputFields,
  rationale,
}) {
  return {
    status: "ok",
    source: SOURCE_ID,
    datasetName,
    method,
    route,
    itemsLimit,
    configuration,
    dataRequest: {
      method,
      route,
      itemsLimit,
      configuration,
    },
    chartSpec,
    outputFields,
    warnings: [],
    errors: [],
    rationale,
  };
}

async function planDataset({ connection, question = "" } = {}) {
  const intent = detectIntent(question);

  if (intent === "campaigns") {
    return planCampaignMetrics({ connection, question });
  }
  if (intent === "activities") {
    return planActivities({ question });
  }

  return planCustomers({ connection, question });
}

function normalizeDataRequest(value = {}) {
  if (value.dataRequest) {
    return normalizeDataRequest(value.dataRequest);
  }

  return {
    method: value.method,
    route: value.route,
    itemsLimit: value.itemsLimit,
    configuration: value.configuration || {},
  };
}

function validateConfiguration(dataRequest = {}) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeDataRequest(dataRequest);

  if (!normalized.route) errors.push("Customer.io route is required.");
  if (!normalized.method) errors.push("Customer.io method is required.");
  if (normalized.route && !isSupportedRoute(normalized.route)) {
    errors.push(`Unsupported Customer.io route: ${normalized.route}`);
  }
  if (normalized.route === "customers" && normalized.method !== "POST") {
    errors.push("Customer.io customers route must use POST.");
  }
  if (normalized.route === "activities" && normalized.method !== "GET") {
    errors.push("Customer.io activities route must use GET.");
  }

  if (normalized.configuration?.cioFilters) {
    const selector = normalized.configuration.cioFilters.and ? "and" : "or";
    const filters = normalized.configuration.cioFilters[selector] || [];
    if (!Array.isArray(filters) || filters.length === 0) {
      errors.push("Customer.io customer filters must include at least one condition.");
    }

    filters.forEach((filter) => {
      const attribute = filter.attribute || filter.not?.attribute;
      if (attribute && !CUSTOMER_FILTER_OPERATORS.has(attribute.operator)) {
        errors.push(`Unsupported Customer.io customer attribute operator: ${attribute.operator}`);
      }
    });
  }

  if (normalized.route?.startsWith("campaigns/")) {
    if (!normalized.configuration?.campaignId) errors.push("Customer.io campaignId is required for campaign metrics.");
    if (!normalized.configuration?.requestRoute) errors.push("Customer.io requestRoute is required for campaign metrics.");
    if (!normalized.configuration?.series) errors.push("Customer.io metric series is required for campaign metrics.");
  }

  if (normalized.route === "activities" && normalized.configuration?.idType) {
    if (!["id", "email", "cio_id"].includes(normalized.configuration.idType)) {
      errors.push(`Unsupported Customer.io activity idType: ${normalized.configuration.idType}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    configuration: normalized,
  };
}

function isSupportedRoute(route = "") {
  return route === "customers"
    || route === "activities"
    || /^campaigns\/[^/]+\/(metrics|metrics\/links|journey_metrics|actions\/[^/]+\/metrics|actions\/[^/]+\/metrics\/links)$/.test(route);
}

function getChartSpec(dataRequest) {
  const route = dataRequest.route || "";
  const configuration = dataRequest.configuration || {};

  if (route === "customers") {
    return resolveCustomerChartSpec({ question: "count" });
  }
  if (route === "activities") {
    return resolveActivityChartSpec({
      question: "count",
      activityType: configuration.activityType,
    });
  }
  if (route.includes("metrics")) {
    const series = configuration.series || "delivered";
    const period = configuration.period || "days";
    return {
      type: "line",
      title: titleCase(series),
      xAxis: `root.${series}[].date`,
      yAxis: `root.${series}[].value`,
      yAxisOperation: "none",
      dateField: `root.${series}[].date`,
      timeInterval: period === "hours" ? "hour" : period.replace(/s$/, ""),
      legend: titleCase(series),
    };
  }

  return { type: "table", title: "Customer.io data" };
}

function rowsFromResponse(response, dataRequest) {
  const route = dataRequest.route || "";
  const configuration = dataRequest.configuration || {};

  if (route === "customers") {
    if (isCountRequest(JSON.stringify(getChartSpec(dataRequest)))) {
      return [{ customer_count: response.customer_count || 0 }];
    }
    return response.customers || [];
  }
  if (route === "activities") {
    return response.activities || [{ activity_count: response.activity_count || 0 }];
  }
  if (configuration.series && Array.isArray(response[configuration.series])) {
    return response[configuration.series];
  }
  if (Array.isArray(response)) return response;

  return [response];
}

function getColumns(rows = []) {
  const sample = rows[0] || {};
  return Object.keys(sample).map((name) => ({
    name,
    type: typeof sample[name],
  }));
}

async function previewConfiguration({ connection, configuration, rowLimit = 25 } = {}) {
  const dataRequest = normalizeDataRequest(configuration);
  const validation = validateConfiguration(dataRequest);
  if (!validation.valid) {
    return {
      status: "invalid",
      ...validation,
    };
  }

  const routeType = dataRequest.route.indexOf("campaigns") === 0
    ? "campaigns"
    : dataRequest.route;
  const fetchers = {
    customers: CustomerioConnection.getCustomers,
    activities: CustomerioConnection.getActivities,
    campaigns: CustomerioConnection.getCampaignMetrics,
  };
  const response = await fetchers[routeType](connection, dataRequest);
  const rows = rowsFromResponse(response, dataRequest).slice(0, rowLimit);

  return {
    status: "ok",
    rows,
    columns: getColumns(rows),
    rowCount: rows.length,
    warnings: validation.warnings,
    chartSpec: getChartSpec(dataRequest),
  };
}

function getCapabilities() {
  return {
    source: SOURCE_ID,
    instructions: SOURCE_INSTRUCTIONS,
    supports: {
      mode: "app_api_v1",
      routes: ["customers", "activities", "campaign_metrics"],
      templates: [],
      chartPlacement: true,
    },
    routeMap: [{
      intent: "customers",
      method: "POST",
      route: "customers",
      configuration: ["populateAttributes", "cioFilters"],
    }, {
      intent: "activities",
      method: "GET",
      route: "activities",
      configuration: ["activityType", "eventName", "customerId", "idType", "deleted", "limit"],
    }, {
      intent: "campaign_metrics",
      method: "GET",
      route: "campaigns/:campaignId/:requestRoute",
      configuration: ["campaignId", "requestRoute", "period", "steps", "series", "type", "unique"],
    }],
    caveats: [
      "Only Customer.io App API read routes already supported by Chartbrew are available.",
      "Campaign metrics need a campaign ID or resolvable campaign name.",
      "Customer.io does not expose arbitrary event schemas through this planner.",
    ],
  };
}

async function listResources({ connection } = {}) {
  const [campaigns, segments, objectTypes] = await Promise.all([
    safeListCampaigns(connection),
    safeListSegments(connection),
    safeListObjectTypes(connection),
  ]);

  return {
    source: SOURCE_ID,
    campaigns: campaigns.slice(0, 25).map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      active: campaign.active,
    })),
    segments: segments.slice(0, 25).map((segment) => ({
      id: segment.id,
      name: segment.name,
      type: segment.type,
    })),
    objectTypes: objectTypes.slice(0, 25).map((type) => ({
      id: type.id,
      name: type.name,
    })),
    activityTypes: ACTIVITY_TYPES.slice(0, 25),
    messageSeries: MESSAGE_SERIES,
    journeySeries: JOURNEY_SERIES,
  };
}

function getSchema() {
  return {
    source: SOURCE_ID,
    entities: [{
      name: "customers",
      kind: "customerio_customers",
      columns: [
        { name: "customer_count", type: "number" },
        { name: "customers[].id", type: "string" },
        { name: "customers[].email", type: "string" },
        { name: "customers[].cio_id", type: "string" },
      ],
    }, {
      name: "activities",
      kind: "customerio_activities",
      columns: [
        { name: "activity_count", type: "number" },
        { name: "activities[].id", type: "string" },
        { name: "activities[].type", type: "string" },
        { name: "activities[].name", type: "string" },
      ],
    }, {
      name: "campaign_metrics",
      kind: "customerio_campaign_metrics",
      columns: [
        { name: "<series>[].date", type: "date" },
        { name: "<series>[].value", type: "number" },
      ],
    }],
  };
}

function listTemplates() {
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

async function getSampleData({ connection, resource = "activities", rowLimit = 5 } = {}) {
  const question = resource === "customers" ? "customer count" : "recent activities";
  const plan = await planDataset({ connection, question });
  if (plan.status !== "ok") return plan;

  return previewConfiguration({
    connection,
    configuration: plan.dataRequest,
    rowLimit,
  });
}

module.exports = {
  getCapabilities,
  getSampleData,
  getSchema,
  instructions: SOURCE_INSTRUCTIONS,
  listResources,
  listTemplates,
  planDataset,
  previewConfiguration,
  recommendTemplates,
  requiresDataRequestRoute: true,
  validateConfiguration,
};
