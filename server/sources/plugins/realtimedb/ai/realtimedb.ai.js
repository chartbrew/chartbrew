const realtimeDbProtocol = require("../realtimedb.protocol");

const SOURCE_ID = "realtimedb";

const SOURCE_INSTRUCTIONS = [
  "Realtime DB uses DataRequest.route for the JSON path and configuration for order/limit settings.",
  "Only use a path explicitly named by the user or listed in connection AI context. Do not invent deep paths.",
  "Use table charts by default for arbitrary JSON paths. Use KPI count charts by counting root[]._key when the user asks for totals.",
  "Use orderBy child/key/value and limitToFirst/limitToLast only when the user asks for ordering or latest/top records.",
  "If the path is missing, ask for the Firebase path or direct the user to add AI context on the connection.",
].join("\n");

function normalizeText(value = "") {
  return String(value).toLowerCase();
}

function normalizePath(value = "") {
  return String(value).trim().replace(/^\/+|\/+$/g, "");
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

function isCountRequest(question = "") {
  const normalizedQuestion = normalizeText(question);
  return normalizedQuestion.includes("count")
    || normalizedQuestion.includes("how many")
    || normalizedQuestion.includes("total")
    || normalizedQuestion.includes("kpi");
}

function parseLimit(question = "", fallback = 100) {
  const normalizedQuestion = normalizeText(question);
  const match = normalizedQuestion.match(/(?:limit|top|first|latest|recent|last)\s+(\d+)/);
  if (!match) return fallback;

  return Math.max(1, Math.min(parseInt(match[1], 10), 500));
}

function getKnownPaths(connection = {}) {
  const context = connection.aiContext
    || connection.options?.aiContext
    || connection.schema?.aiContext
    || connection.schema?.realtimeDb?.aiContext;

  if (Array.isArray(context?.paths)) {
    return context.paths.map((path) => {
      if (typeof path === "string") return { path: normalizePath(path), label: normalizePath(path) };
      return {
        path: normalizePath(path.path || path.route || path.name),
        label: path.label || path.description || normalizePath(path.path || path.route || path.name),
      };
    }).filter((path) => path.path);
  }

  return [];
}

function pathFromQuestion(question = "") {
  const explicitPath = question.match(/(?:path|under|from|route)\s+["']?\/?([a-zA-Z0-9_/-]+)["']?/i);
  if (explicitPath) return normalizePath(explicitPath[1]);

  const slashPath = question.match(/\/([a-zA-Z0-9_/-]+)/);
  if (slashPath) return normalizePath(slashPath[1]);

  const simplePath = question.match(/(?:show|list|count|latest|recent|top)\s+([a-zA-Z0-9_-]+)(?:\s|$)/i);
  const reserved = new Set(["data", "items", "records", "rows", "total", "latest", "recent"]);
  if (simplePath && !reserved.has(normalizeText(simplePath[1]))) {
    return normalizePath(simplePath[1]);
  }

  return "";
}

function findKnownPath(paths = [], question = "") {
  const normalizedQuestion = normalizeSearchText(question);
  const explicit = pathFromQuestion(question);
  if (explicit) {
    return paths.find((path) => path.path === explicit) || { path: explicit, label: explicit };
  }

  const matches = paths
    .map((path) => {
      const values = [path.path, path.label, singularize(path.path), singularize(path.label || "")].filter(Boolean);
      const score = values.some((value) => normalizedQuestion.includes(normalizeSearchText(value))) ? 100 : 0;
      return { path, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0].path;
  if (matches[0].score > matches[1].score) return matches[0].path;

  return null;
}

function resolveOrdering(question = "") {
  const normalizedQuestion = normalizeText(question);
  const config = {};
  const limit = parseLimit(question);

  if (normalizedQuestion.includes("latest") || normalizedQuestion.includes("last ")) {
    config.limitToLast = limit;
    config.limitToFirst = 0;
  } else if (normalizedQuestion.includes("top") || normalizedQuestion.includes("first")) {
    config.limitToFirst = limit;
    config.limitToLast = 0;
  } else {
    config.limitToLast = limit;
    config.limitToFirst = 0;
  }

  const orderMatch = question.match(/order(?:ed)? by\s+([a-zA-Z0-9_.$-]+|key|value)/i);
  if (orderMatch) {
    const field = normalizeText(orderMatch[1]);
    if (field === "key") {
      config.orderBy = "key";
    } else if (field === "value") {
      config.orderBy = "value";
    } else {
      config.orderBy = "child";
      config.key = orderMatch[1];
    }
  }

  return config;
}

function buildChartSpec({ route, question = "" }) {
  if (isCountRequest(question)) {
    return {
      type: "kpi",
      title: `${titleCase(route)} count`,
      yAxis: "root[]._key",
      yAxisOperation: "count",
      legend: "Records",
    };
  }

  return {
    type: "table",
    title: `${titleCase(route)} records`,
    columnsOrder: ["_key"],
    maxRecords: 100,
  };
}

async function planDataset({ connection, question = "" } = {}) {
  const knownPaths = getKnownPaths(connection);
  const path = findKnownPath(knownPaths, question);

  if (!path) {
    return {
      status: knownPaths.length > 0 ? "needs_disambiguation" : "needs_more_context",
      source: SOURCE_ID,
      message: knownPaths.length > 0
        ? "Choose a Realtime DB path before I build this dataset."
        : "I need the Firebase Realtime Database path before I can build this dataset. Add the path in your request or save AI path context on the connection.",
      options: knownPaths.slice(0, 10).map((candidate) => ({
        label: candidate.label || candidate.path,
        value: candidate.path,
      })),
      requiredContext: knownPaths.length > 0 ? [] : ["route"],
      warnings: [],
      errors: [],
    };
  }

  const route = path.path || path;
  const configuration = resolveOrdering(question);
  const chartSpec = buildChartSpec({ route, question });

  return {
    status: "ok",
    source: SOURCE_ID,
    datasetName: chartSpec.title,
    route,
    configuration,
    dataRequest: {
      route,
      configuration,
    },
    chartSpec,
    outputFields: ["root[]._key"],
    warnings: [],
    errors: [],
    rationale: {
      intent: isCountRequest(question) ? "count_path_records" : "list_path_records",
      route,
    },
  };
}

function normalizeDataRequest(value = {}) {
  if (value.dataRequest) return normalizeDataRequest(value.dataRequest);
  return {
    route: normalizePath(value.route),
    configuration: value.configuration || {},
  };
}

function validateConfiguration(dataRequest = {}) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeDataRequest(dataRequest);

  if (!normalized.route) errors.push("Realtime DB route/path is required.");
  if (normalized.route.includes("..")) errors.push("Realtime DB route cannot include '..'.");
  if (normalized.configuration.orderBy && !["child", "key", "value"].includes(normalized.configuration.orderBy)) {
    errors.push(`Unsupported Realtime DB orderBy: ${normalized.configuration.orderBy}`);
  }
  if (normalized.configuration.orderBy === "child" && !normalized.configuration.key) {
    errors.push("Realtime DB orderBy child requires configuration.key.");
  }

  ["limitToFirst", "limitToLast"].forEach((field) => {
    if (normalized.configuration[field] !== undefined && normalized.configuration[field] !== "") {
      const limit = parseInt(normalized.configuration[field], 10);
      if (Number.isNaN(limit) || limit < 0) errors.push(`Realtime DB ${field} must be a positive number or 0.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    configuration: normalized,
  };
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

  const realtimeDatabase = realtimeDbProtocol.createRealtimeDatabase(connection, `ai_preview_${connection?.id || "unsaved"}`);
  const response = await realtimeDatabase.getData({
    id: null,
    route: dataRequest.route,
    configuration: dataRequest.configuration,
  });
  const rows = (Array.isArray(response) ? response : []).slice(0, rowLimit);

  return {
    status: "ok",
    rows,
    columns: getColumns(rows),
    rowCount: rows.length,
    warnings: validation.warnings,
    chartSpec: buildChartSpec({
      route: dataRequest.route,
      question: "list",
    }),
  };
}

function getCapabilities() {
  return {
    source: SOURCE_ID,
    instructions: SOURCE_INSTRUCTIONS,
    supports: {
      mode: "path_query",
      configuration: ["orderBy", "key", "limitToFirst", "limitToLast"],
      chartPlacement: true,
      templates: [],
    },
    caveats: [
      "Realtime DB has no cheap global schema discovery, so requests need explicit paths or saved AI context.",
      "Arbitrary JSON paths are best rendered as tables unless a metric/date field is known from context.",
    ],
  };
}

function listResources({ connection } = {}) {
  return {
    source: SOURCE_ID,
    paths: getKnownPaths(connection),
    orderByModes: ["child", "key", "value"],
  };
}

function getSchema({ connection } = {}) {
  const resources = listResources({ connection });
  return {
    source: SOURCE_ID,
    entities: resources.paths.map((path) => ({
      name: path.path,
      kind: "realtimedb_path",
      columns: [{ name: "_key", type: "string" }],
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
  const route = normalizePath(resource || "");
  if (!route) {
    return {
      status: "needs_more_context",
      message: "Choose a Realtime DB path before fetching sample data.",
      requiredContext: ["resource"],
    };
  }

  return previewConfiguration({
    connection,
    configuration: {
      route,
      configuration: { limitToLast: rowLimit, limitToFirst: 0 },
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
  requiresDataRequestRoute: true,
  validateConfiguration,
};
