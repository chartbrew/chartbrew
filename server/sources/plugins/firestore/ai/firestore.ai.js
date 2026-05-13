const firestoreProtocol = require("../firestore.protocol");

const SOURCE_ID = "firestore";

const SOURCE_INSTRUCTIONS = [
  "Firestore uses DataRequest.query for the collection path, DataRequest.conditions for filters, and configuration for order/limit settings.",
  "Only query collections that are named by the user or returned by Firestore metadata. Do not invent collection paths.",
  "Use small default limits for list/table previews. Use KPI count charts by counting root[]._id when the user asks for totals.",
  "Only add filter fields explicitly named by the user or seen in samples.",
  "Combined filters and ordering can require a Firestore index; surface validation errors instead of retrying different indexes.",
].join("\n");

const FILTER_OPERATORS = new Set([
  "==",
  "!=",
  "isNull",
  "isNotNull",
  ">",
  ">=",
  "<",
  "<=",
  "array-contains",
  "array-contains-any",
  "in",
  "not-in",
]);

function normalizeText(value = "") {
  return String(value).toLowerCase();
}

function normalizeSearchText(value = "") {
  return normalizeText(value)
    .replace(/[^a-z0-9/_-]+/g, " ")
    .trim();
}

function titleCase(value = "") {
  return String(value)
    .replace(/[/_-]+/g, " ")
    .replace(/\w\S*/g, (word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`);
}

function singularize(value = "") {
  return value.endsWith("s") ? value.slice(0, -1) : value;
}

function getQuestionTokens(question = "") {
  const ignoredTokens = new Set([
    "a",
    "all",
    "and",
    "by",
    "chart",
    "collection",
    "count",
    "documents",
    "firestore",
    "for",
    "from",
    "in",
    "latest",
    "list",
    "make",
    "of",
    "recent",
    "records",
    "show",
    "the",
    "total",
    "where",
    "with",
  ]);

  return normalizeSearchText(question)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !ignoredTokens.has(token));
}

function isCountRequest(question = "") {
  const normalizedQuestion = normalizeText(question);
  return normalizedQuestion.includes("count")
    || normalizedQuestion.includes("how many")
    || normalizedQuestion.includes("total")
    || normalizedQuestion.includes("kpi");
}

function getBreakdownField(question = "") {
  const normalizedQuestion = normalizeText(question);
  const byMatch = question.match(/\bby\s+([a-zA-Z0-9_.$-]+)/i);
  if (byMatch) return singularize(byMatch[1]);

  const typedResource = question.match(/\b[a-zA-Z0-9_-]+\s+(types?|statuses?|categories?)\b/i);
  if (typedResource) {
    const token = normalizeText(typedResource[1]);
    if (token.startsWith("type")) return "type";
    if (token.startsWith("status")) return "status";
    if (token.startsWith("categor")) return "category";
  }

  if (normalizedQuestion.includes(" by type") || normalizedQuestion.includes(" types")) return "type";
  if (normalizedQuestion.includes(" by status") || normalizedQuestion.includes(" statuses")) return "status";
  if (normalizedQuestion.includes(" by category") || normalizedQuestion.includes(" categories")) return "category";

  return "";
}

function isBreakdownRequest(question = "") {
  return Boolean(getBreakdownField(question));
}

function parseLimit(question = "", fallback = 100) {
  const normalizedQuestion = normalizeText(question);
  const match = normalizedQuestion.match(/(?:limit|top|first|latest|recent)\s+(\d+)/);
  if (!match) return fallback;

  return Math.max(1, Math.min(parseInt(match[1], 10), 500));
}

function collectionName(collection = {}) {
  return collection.id || collection.path || collection._queryOptions?.collectionId;
}

function getCollectionCandidates(collections = []) {
  return collections
    .map((collection) => ({
      id: collectionName(collection),
      path: collection.path || collectionName(collection),
    }))
    .filter((collection) => collection.id);
}

function scoreCollection(collection, question = "") {
  const normalizedQuestion = normalizeSearchText(question);
  const id = collection.id || "";
  const path = collection.path || id;
  const values = [id, path, singularize(id), singularize(path)].filter(Boolean);

  if (values.some((value) => normalizedQuestion.includes(normalizeSearchText(value)))) {
    return 100;
  }

  const questionTokens = new Set(getQuestionTokens(question));
  const collectionTokens = getQuestionTokens(id);
  if (collectionTokens.length === 0) return 0;

  const matchedTokens = collectionTokens.filter((token) => {
    return questionTokens.has(token) || questionTokens.has(singularize(token));
  });
  const score = matchedTokens.length / collectionTokens.length;
  return score >= 0.75 ? Math.round(score * 90) : 0;
}

function findCollection(collections = [], question = "") {
  const candidates = getCollectionCandidates(collections);
  const matches = candidates
    .map((collection) => ({
      collection,
      score: scoreCollection(collection, question),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matches.length === 0) {
    const explicitPath = question.match(/(?:collection|path)\s+["']?([a-zA-Z0-9_/-]+)["']?/i);
    if (explicitPath) {
      return {
        id: explicitPath[1],
        path: explicitPath[1],
      };
    }
    return null;
  }
  if (matches.length === 1) return matches[0].collection;
  if (matches[0].score > matches[1].score) return matches[0].collection;

  return null;
}

async function getCollections(connection) {
  if (!connection) return [];

  try {
    const metadata = await firestoreProtocol.getBuilderMetadata({ connection });
    return metadata.collections || [];
  } catch {
    return [];
  }
}

function parseValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

function parseCondition(question = "", collectionId = "") {
  const patterns = [
    /(?:where|with)\s+([a-zA-Z0-9_.$-]+)\s+(?:is|equals|=)\s+["']?(.+?)["']?(?:\s+order by|\s+limit|$)/i,
    /([a-zA-Z0-9_.$-]+)\s+(?:is|equals|=)\s+["']?(.+?)["']?(?:\s+order by|\s+limit|$)/i,
  ];
  const match = patterns
    .map((pattern) => question.match(pattern))
    .find(Boolean);

  if (!match) return [];

  return [{
    collection: collectionId,
    field: `root[].${match[1]}`,
    operator: "==",
    value: parseValue(match[2].trim()),
  }];
}

function resolveOrder(question = "") {
  const normalizedQuestion = normalizeText(question);
  const config = {};

  if (normalizedQuestion.includes("latest") || normalizedQuestion.includes("recent")) {
    config.limit = parseLimit(question, 100);
    return config;
  }

  const orderMatch = question.match(/order(?:ed)? by\s+([a-zA-Z0-9_.$-]+)(?:\s+(asc|ascending|desc|descending))?/i);
  if (orderMatch) {
    config.orderBy = orderMatch[1];
    config.orderByDirection = orderMatch[2]?.startsWith("asc") ? "asc" : "desc";
  }

  return config;
}

function buildChartSpec({ collectionId, question = "" }) {
  const breakdownField = getBreakdownField(question);
  if (breakdownField) {
    return {
      type: normalizeText(question).match(/donut|doughnut/) ? "doughnut" : "bar",
      title: `${titleCase(collectionId)} by ${titleCase(breakdownField)}`,
      xAxis: `root[].${breakdownField}`,
      yAxis: "root[]._id",
      yAxisOperation: "count",
      legend: "Documents",
    };
  }

  if (isCountRequest(question)) {
    return {
      type: "kpi",
      title: `${titleCase(collectionId)} count`,
      yAxis: "root[]._id",
      yAxisOperation: "count",
      legend: "Documents",
    };
  }

  return {
    type: "table",
    title: `${titleCase(collectionId)} records`,
    columnsOrder: ["_id"],
    maxRecords: 100,
  };
}

function getIntent(question = "") {
  if (isBreakdownRequest(question)) return "breakdown_documents";
  if (isCountRequest(question)) return "count_documents";
  return "list_documents";
}

async function planDataset({ connection, question = "" } = {}) {
  const collections = await getCollections(connection);
  const collection = findCollection(collections, question);

  if (!collection) {
    return {
      status: collections.length > 0 ? "needs_disambiguation" : "needs_more_context",
      source: SOURCE_ID,
      message: collections.length > 0
        ? "Choose a Firestore collection before I build this dataset."
        : "I need the Firestore collection path before I can build this dataset.",
      options: getCollectionCandidates(collections).slice(0, 10).map((candidate) => ({
        label: candidate.path || candidate.id,
        value: candidate.path || candidate.id,
      })),
      requiredContext: collections.length > 0 ? [] : ["query"],
      warnings: [],
      errors: [],
    };
  }

  const collectionId = collection.path || collection.id;
  const conditions = parseCondition(question, collectionId);
  const configuration = {
    limit: parseLimit(question),
    ...resolveOrder(question),
  };
  const chartSpec = buildChartSpec({ collectionId, question });

  return {
    status: "ok",
    source: SOURCE_ID,
    datasetName: chartSpec.title,
    query: collectionId,
    configuration,
    conditions,
    dataRequest: {
      query: collectionId,
      configuration,
      conditions,
    },
    chartSpec,
    outputFields: chartSpec.type === "kpi" ? ["root[]._id"] : ["root[]._id"],
    warnings: configuration.orderBy
      ? ["Firestore can require a composite index when orderBy is combined with filters."]
      : [],
    errors: [],
    rationale: {
      intent: getIntent(question),
      collection: collectionId,
    },
  };
}

function normalizeDataRequest(value = {}) {
  if (value.dataRequest) return normalizeDataRequest(value.dataRequest);
  return {
    query: value.query,
    configuration: value.configuration || {},
    conditions: value.conditions || [],
  };
}

function validateConfiguration(dataRequest = {}) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeDataRequest(dataRequest);

  if (!normalized.query) errors.push("Firestore collection query is required.");
  if (normalized.configuration.limit !== undefined && normalized.configuration.limit !== "") {
    const limit = parseInt(normalized.configuration.limit, 10);
    if (Number.isNaN(limit) || limit < 0) errors.push("Firestore limit must be a positive number or 0.");
  }
  if (normalized.configuration.orderByDirection && !["asc", "desc"].includes(normalized.configuration.orderByDirection)) {
    errors.push(`Unsupported Firestore orderByDirection: ${normalized.configuration.orderByDirection}`);
  }

  normalized.conditions.forEach((condition) => {
    if (!condition.field) errors.push("Firestore condition field is required.");
    if (!FILTER_OPERATORS.has(condition.operator)) {
      errors.push(`Unsupported Firestore operator: ${condition.operator}`);
    }
  });

  if (normalized.configuration.orderBy && normalized.conditions.length > 0) {
    warnings.push("Firestore may require a composite index for this filter/order combination.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    configuration: normalized,
  };
}

function rowsFromResponse(response) {
  return Array.isArray(response?.data) ? response.data : [];
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

  const firestore = firestoreProtocol.createFirestoreConnection(connection, `ai_preview_${connection?.id || "unsaved"}`);
  const response = await firestore.get({
    id: null,
    query: dataRequest.query,
    configuration: dataRequest.configuration,
    conditions: dataRequest.conditions,
  });
  const rows = rowsFromResponse(response).slice(0, rowLimit);

  return {
    status: "ok",
    rows,
    columns: getColumns(rows),
    rowCount: rows.length,
    warnings: validation.warnings,
    chartSpec: buildChartSpec({
      collectionId: dataRequest.query,
      question: "list",
    }),
  };
}

function getCapabilities() {
  return {
    source: SOURCE_ID,
    instructions: SOURCE_INSTRUCTIONS,
    supports: {
      mode: "collection_query",
      conditions: Array.from(FILTER_OPERATORS),
      configuration: ["limit", "orderBy", "orderByDirection", "showSubCollections", "selectedSubCollection"],
      chartPlacement: true,
      templates: [],
    },
    caveats: [
      "Firestore collection names are required unless metadata lists a matching collection.",
      "Combined filters and ordering may require Firestore indexes.",
    ],
  };
}

async function listResources({ connection } = {}) {
  const collections = await getCollections(connection);

  return {
    source: SOURCE_ID,
    collections: getCollectionCandidates(collections).slice(0, 50),
    operators: Array.from(FILTER_OPERATORS),
  };
}

async function getSchema({ connection } = {}) {
  const resources = await listResources({ connection });
  return {
    source: SOURCE_ID,
    entities: resources.collections.map((collection) => ({
      name: collection.path || collection.id,
      kind: "firestore_collection",
      columns: [{ name: "_id", type: "string" }],
    })),
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

async function getSampleData({ connection, resource, rowLimit = 5 } = {}) {
  if (!resource) {
    return {
      status: "needs_more_context",
      message: "Choose a Firestore collection before fetching sample data.",
      requiredContext: ["resource"],
    };
  }

  return previewConfiguration({
    connection,
    configuration: {
      query: resource,
      configuration: { limit: rowLimit },
      conditions: [],
    },
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
  requiresDataRequestQuery: true,
  validateConfiguration,
};
