const apiProtocol = require("../../../shared/protocols/api.protocol");

const SOURCE_ID = "api";
const MAX_CONTEXT_CHARS = 12000;

const SOURCE_INSTRUCTIONS = [
  "Generic API planning prefers connection AI Context, then explicit user-provided routes, then model/provider knowledge for recognizable API hosts.",
  "For unknown API hosts, do not invent endpoints; ask the user to add AI Context.",
  "For recognizable provider hosts, model memory may be used as a fallback when context is missing or incomplete, but the tool call must include the full method, route, pagination/array assumptions, and chart bindings.",
  "Return DataRequest method, route, headers/body only when documented, pagination settings, and chart bindings.",
  "If model/provider fallback is uncertain or a request fails because the response shape is unknown, ask the user to add AI Context and include the direct edit link.",
].join("\n");

const PROVIDER_HINTS = [{
  id: "posthog",
  label: "PostHog",
  hosts: ["posthog.com", "posthog.io", "posthog"],
  guidance: "This looks like a PostHog API connection. Prefer any pasted AI Context, but you may use known PostHog API routes as a fallback if you can provide the full route and reasonable response-shape assumptions.",
}, {
  id: "github",
  label: "GitHub",
  hosts: ["api.github.com", "github.com"],
  guidance: "This looks like a GitHub API connection. Prefer any pasted AI Context, but you may use known GitHub API routes as a fallback if you can provide the full route and reasonable response-shape assumptions.",
}, {
  id: "hubspot",
  label: "HubSpot",
  hosts: ["api.hubapi.com", "hubspot.com"],
  guidance: "This looks like a HubSpot API connection. Prefer any pasted AI Context, but you may use known HubSpot API routes as a fallback if you can provide the full route and reasonable response-shape assumptions.",
}, {
  id: "linear",
  label: "Linear",
  hosts: ["api.linear.app", "linear.app"],
  guidance: "This looks like a Linear API connection. Prefer any pasted AI Context, but you may use known Linear API request shapes as a fallback if you can provide the full request and reasonable response-shape assumptions.",
}];

function normalizeText(value = "") {
  return String(value).toLowerCase();
}

function normalizeRoute(value = "") {
  const route = String(value).trim();
  if (!route) return "";

  try {
    const url = new URL(route);
    return `${url.pathname}${url.search}`;
  } catch {
    return route.startsWith("/") || route.startsWith("?") ? route : `/${route}`;
  }
}

function getAiContext(connection = {}) {
  return String(
    connection.schema?.apiAiContext?.raw
    || connection.schema?.aiContext?.raw
    || connection.apiAiContext?.raw
    || ""
  ).slice(0, MAX_CONTEXT_CHARS);
}

function getConnectionHost(connection = {}) {
  if (typeof connection.getApiUrl === "function") {
    try {
      return connection.getApiUrl(connection);
    } catch {
      return connection.host || "";
    }
  }

  return connection.host || "";
}

function getEditConnectionUrl(connection = {}) {
  return connection.id ? `/connections/${connection.id}?tab=aiContext` : "/connections";
}

function getProviderHint(connection = {}) {
  const host = normalizeText(getConnectionHost(connection));
  if (!host) return null;

  const hint = PROVIDER_HINTS.find((provider) => {
    return provider.hosts.some((candidate) => host.includes(candidate));
  });

  if (!hint) return null;

  return {
    id: hint.id,
    label: hint.label,
    guidance: hint.guidance,
    modelFallbackAllowed: true,
  };
}

function getApiContextGuidance(connection = {}) {
  const providerHint = getProviderHint(connection);

  return {
    editConnectionUrl: getEditConnectionUrl(connection),
    providerHint,
    contextInstructions: [
      "Open the API connection and go to the AI Context tab.",
      "Paste endpoints Chartbrew AI should prefer. For recognizable providers, this improves or overrides model fallback knowledge.",
      "Include request paths or curl examples, response samples, array path, date filters, pagination, and chartable fields.",
      "Do not paste API keys, cookies, tokens, or other secrets.",
    ],
    exampleAiContext: [
      "GET /orders",
      "Returns { \"data\": [{ \"id\": \"ord_1\", \"amount\": 25, \"status\": \"paid\", \"created_at\": \"2026-05-01\" }] }",
      "Use data as the array path.",
      "Filter dates with start_date and end_date. Date format YYYY-MM-DD.",
    ].join("\n"),
  };
}

function stripHostFromRoute(route = "", host = "") {
  if (!host || !route.startsWith(host)) return route;
  return route.slice(host.length) || "/";
}

function extractEndpoints(rawContext = "", host = "") {
  const endpoints = [];
  const seen = new Set();
  const lines = rawContext.split(/\r?\n/);
  const methodRoutePattern = /\b(GET|POST|PUT|PATCH|DELETE)\s+((?:https?:\/\/[^\s"'`]+)|(?:\/[^\s"'`]+)|(?:\?[^\s"'`]+))/gi;
  const curlPattern = /curl\s+(?:-[A-Za-z]\s+["']?[^"'\s]+["']?\s+)*["']?((?:https?:\/\/[^\s"'`]+)|(?:\/[^\s"'`]+))/gi;

  const addEndpoint = ({ method = "GET", route, description = "" }) => {
    const normalizedRoute = normalizeRoute(stripHostFromRoute(route, host));
    if (!normalizedRoute) return;

    const key = `${method}:${normalizedRoute}`;
    if (seen.has(key)) return;
    seen.add(key);
    endpoints.push({
      method,
      route: normalizedRoute,
      description,
    });
  };

  lines.forEach((line) => {
    [...line.matchAll(methodRoutePattern)].forEach((match) => {
      addEndpoint({
        method: match[1].toUpperCase(),
        route: match[2],
        description: line.trim(),
      });
    });
    [...line.matchAll(curlPattern)].forEach((match) => {
      addEndpoint({
        method: line.match(/\s-X\s+([A-Z]+)/i)?.[1]?.toUpperCase() || "GET",
        route: match[1],
        description: line.trim(),
      });
    });
  });

  return endpoints.slice(0, 25);
}

function extractJsonSamples(rawContext = "") {
  const samples = [];
  const fencedJson = [...rawContext.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)]
    .map((match) => match[1]);
  const inlineObjects = [...rawContext.matchAll(/(\{[\s\S]{20,2000}\})/g)]
    .map((match) => match[1]);

  [...fencedJson, ...inlineObjects].forEach((sample) => {
    try {
      samples.push(JSON.parse(sample));
    } catch {
      // Keep context free-form; invalid pasted snippets are ignored.
    }
  });

  return samples.slice(0, 5);
}

function findArrayPaths(value, prefix = "root") {
  if (Array.isArray(value)) {
    return [prefix];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.keys(value).flatMap((key) => {
    return findArrayPaths(value[key], `${prefix}.${key}`);
  });
}

function normalizeArrayPath(path = "") {
  if (!path || path === "root") return "root";
  return path.replace(/^root\./, "");
}

function inferArrayPath(rawContext = "") {
  const explicit = rawContext.match(/(?:array path|items path|data path|records path)\s*(?:is|:|=)?\s*["'`]?([a-zA-Z0-9_.[\]]+)["'`]?/i);
  if (explicit) {
    const value = explicit[1].replace(/\[\]$/, "").replace(/^[._-]+|[._-]+$/g, "");
    if (/[a-z0-9]/i.test(value) && !["the", "as", "is"].includes(normalizeText(value))) return value;
  }

  if (/\bdata\b[\s\S]{0,80}\[\s*\{/.test(rawContext)) return "data";
  if (/\bitems\b[\s\S]{0,80}\[\s*\{/.test(rawContext)) return "items";
  if (/\bresults\b[\s\S]{0,80}\[\s*\{/.test(rawContext)) return "results";
  if (/\brecords\b[\s\S]{0,80}\[\s*\{/.test(rawContext)) return "records";

  const samples = extractJsonSamples(rawContext);
  const paths = samples.flatMap((sample) => findArrayPaths(sample));
  const firstPath = paths[0];
  return normalizeArrayPath(firstPath || "root");
}

function inferFields(rawContext = "", arrayPath = "root") {
  const arrayPathPattern = arrayPath === "root"
    ? /\[\s*\{\s*([^}\]]+)/m
    : new RegExp(`${arrayPath}\\s*["']?\\s*[:=]?\\s*\\[\\s*\\{\\s*([^}\\]]+)`, "im");
  const looseSample = rawContext.match(arrayPathPattern);
  if (looseSample) {
    const fieldMatches = [...looseSample[1].matchAll(/["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?\s*:/g)]
      .map((match) => match[1]);
    if (fieldMatches.length > 0) return [...new Set(fieldMatches)];
  }

  const samples = extractJsonSamples(rawContext);
  const pathSegments = arrayPath === "root" ? [] : arrayPath.split(".");
  const sampleRows = samples.flatMap((sample) => {
    let current = sample;
    pathSegments.forEach((segment) => {
      current = current?.[segment];
    });
    if (Array.isArray(current)) return current;
    if (Array.isArray(sample)) return sample;
    return [];
  });
  const firstRow = sampleRows.find((row) => row && typeof row === "object") || {};

  return Object.keys(firstRow);
}

function findEndpointForQuestion(endpoints = [], question = "") {
  if (endpoints.length === 0) return null;

  const normalizedQuestion = normalizeText(question);
  const routeMention = question.match(/(?:endpoint|route|path|url)\s+["']?((?:\/|\?)[^"'\s]+)["']?/i)
    || question.match(/((?:\/|\?)[a-zA-Z0-9_/?=&.-]+)/);
  if (routeMention) {
    const route = normalizeRoute(routeMention[1]);
    return endpoints.find((endpoint) => endpoint.route === route) || {
      method: "GET",
      route,
      description: "Explicit route from user request",
    };
  }

  const scored = endpoints
    .map((endpoint) => {
      const routeTokens = endpoint.route
        .split(/[^a-zA-Z0-9]+/)
        .filter((token) => token.length > 2);
      const matched = routeTokens.filter((token) => normalizedQuestion.includes(normalizeText(token)));
      return {
        endpoint,
        score: routeTokens.length > 0 ? matched.length / routeTokens.length : 0,
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return endpoints.length === 1 ? endpoints[0] : null;
  if (scored.length === 1) return scored[0].endpoint;
  if (scored[0].score > scored[1].score) return scored[0].endpoint;

  return null;
}

function isCountRequest(question = "") {
  const normalizedQuestion = normalizeText(question);
  return normalizedQuestion.includes("count")
    || normalizedQuestion.includes("how many")
    || normalizedQuestion.includes("total")
    || normalizedQuestion.includes("kpi");
}

function inferMetricField(fields = [], question = "") {
  const normalizedQuestion = normalizeText(question);
  const preferred = fields.find((field) => normalizedQuestion.includes(normalizeText(field)));
  if (preferred) return preferred;

  return fields.find((field) => /amount|total|revenue|count|value|price|score/i.test(field));
}

function inferDateField(fields = [], question = "") {
  const normalizedQuestion = normalizeText(question);
  const preferred = fields.find((field) => normalizedQuestion.includes(normalizeText(field)));
  if (preferred) return preferred;

  return fields.find((field) => /date|time|created|updated|timestamp/i.test(field));
}

function buildChartSpec({ question = "", route, arrayPath = "root", fields = [] }) {
  const traversalBase = arrayPath === "root" ? "root[]" : `root.${arrayPath}[]`;
  const metricField = inferMetricField(fields, question);
  const dateField = inferDateField(fields, question);

  if (isCountRequest(question)) {
    return {
      type: "kpi",
      title: `${route} count`,
      yAxis: `${traversalBase}.${fields[0] || "id"}`,
      yAxisOperation: "count",
      legend: "Records",
    };
  }

  if (dateField && metricField && normalizeText(question).includes("over time")) {
    return {
      type: "line",
      title: `${metricField} over time`,
      xAxis: `${traversalBase}.${dateField}`,
      yAxis: `${traversalBase}.${metricField}`,
      yAxisOperation: "none",
      dateField: `${traversalBase}.${dateField}`,
      timeInterval: "day",
      legend: metricField,
    };
  }

  return {
    type: "table",
    title: `${route} records`,
    columnsOrder: fields,
    maxRecords: 100,
  };
}

function appendDateVariables(route, rawContext = "", question = "") {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion.match(/last\s+\d+\s+days?|today|yesterday|this month|date range/)) {
    return route;
  }

  const startParam = rawContext.match(/(?:start(?: date)? param|start_param|start parameter)\s*(?:is|:|=)?\s*["'`]?([a-zA-Z0-9_-]+)["'`]?/i)?.[1]
    || rawContext.match(/\b(start_date|from|start|since)\b/)?.[1];
  const endParam = rawContext.match(/(?:end(?: date)? param|end_param|end parameter)\s*(?:is|:|=)?\s*["'`]?([a-zA-Z0-9_-]+)["'`]?/i)?.[1]
    || rawContext.match(/\b(end_date|to|end|until)\b/)?.[1];

  if (!startParam || !endParam || route.includes("{{start_date}}") || route.includes("{{end_date}}")) {
    return route;
  }

  const joiner = route.includes("?") ? "&" : "?";
  return `${route}${joiner}${startParam}={{start_date}}&${endParam}={{end_date}}`;
}

function buildVariables(route, rawContext = "") {
  if (!route.includes("{{start_date}}") && !route.includes("{{end_date}}")) {
    return undefined;
  }

  const format = rawContext.match(/(?:date format|format)\s*(?:is|:|=)?\s*["'`]?([A-ZYa-z0-9_/-]+)["'`]?/i)?.[1]
    || "YYYY-MM-DD";

  return {
    startDate: {
      type: "date",
      value: "{{start_date}}",
    },
    endDate: {
      type: "date",
      value: "{{end_date}}",
    },
    dateFormat: {
      type: "string",
      value: format,
    },
  };
}

function getContextSummary(connection = {}) {
  const raw = getAiContext(connection);
  const host = getConnectionHost(connection);
  const endpoints = extractEndpoints(raw, host);
  const arrayPath = inferArrayPath(raw);
  const fields = inferFields(raw, arrayPath);
  const providerHint = getProviderHint(connection);

  return {
    raw,
    host,
    endpoints,
    arrayPath,
    fields,
    providerHint,
  };
}

async function planDataset({ connection, question = "" } = {}) {
  const context = getContextSummary(connection);

  if (!context.raw.trim() && !context.providerHint?.modelFallbackAllowed) {
    return {
      status: "needs_more_context",
      source: SOURCE_ID,
      message: "I need API AI context before I can safely create a chart from this generic API. Edit the API connection and paste endpoint notes, docs, curl examples, or response samples in AI Context.",
      ...getApiContextGuidance(connection),
      requiredContext: ["apiAiContext.raw"],
      warnings: [],
      errors: [],
    };
  }

  const endpoint = findEndpointForQuestion(context.endpoints, question);
  if (!endpoint) {
    if (context.providerHint?.modelFallbackAllowed) {
      return {
        status: "needs_model_planning",
        source: SOURCE_ID,
        message: `${context.providerHint.label} was recognized from the API host, but this source planner does not have enough connection AI Context to build the route deterministically. Use model/provider knowledge as a fallback only if you can provide the full method, route, pagination/array assumptions, and chart bindings.`,
        ...getApiContextGuidance(connection),
        requiredContext: context.raw.trim() ? ["endpoint or response shape"] : ["apiAiContext.raw"],
        warnings: ["Using model/provider fallback without explicit AI Context can fail if the provider API changed or the workspace uses a different response shape."],
        errors: [],
      };
    }

    return {
      status: "needs_more_context",
      source: SOURCE_ID,
      message: "I could not find a matching endpoint in this API connection's AI Context. Add the endpoint path or ask using one of the listed routes.",
      ...getApiContextGuidance(connection),
      requiredContext: ["endpoint"],
      options: context.endpoints.slice(0, 10).map((candidate) => ({
        label: `${candidate.method} ${candidate.route}`,
        value: candidate.route,
      })),
      warnings: [],
      errors: [],
    };
  }

  const route = appendDateVariables(endpoint.route, context.raw, question);
  const chartSpec = buildChartSpec({
    question,
    route: endpoint.route,
    arrayPath: context.arrayPath,
    fields: context.fields,
  });
  const variables = buildVariables(route, context.raw);
  const outputBase = context.arrayPath === "root"
    ? "root[]"
    : `root.${context.arrayPath}[]`;

  return {
    status: "ok",
    source: SOURCE_ID,
    datasetName: chartSpec.title,
    method: endpoint.method || "GET",
    route,
    itemsLimit: 100,
    variables,
    dataRequest: {
      method: endpoint.method || "GET",
      route,
      itemsLimit: 100,
      useGlobalHeaders: true,
      ...(variables ? { variables } : {}),
    },
    chartSpec,
    outputFields: chartSpec.type === "table"
      ? context.fields.map((field) => `${outputBase}.${field}`)
      : [chartSpec.yAxis],
    warnings: [],
    errors: [],
    rationale: {
      endpoint: endpoint.route,
      arrayPath: context.arrayPath,
    },
  };
}

function normalizeDataRequest(value = {}) {
  if (value.dataRequest) return normalizeDataRequest(value.dataRequest);
  return {
    method: value.method || "GET",
    route: normalizeRoute(value.route),
    itemsLimit: value.itemsLimit,
    useGlobalHeaders: value.useGlobalHeaders !== false,
    variables: value.variables,
    body: value.body,
    headers: value.headers,
    pagination: value.pagination,
    items: value.items,
    offset: value.offset,
    paginationField: value.paginationField,
    template: value.template,
  };
}

function validateConfiguration(dataRequest = {}, { connection } = {}) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeDataRequest(dataRequest);
  const context = getContextSummary(connection);

  if (!normalized.route) errors.push("API route is required.");
  if (!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(normalized.method)) {
    errors.push(`Unsupported API method: ${normalized.method}`);
  }
  if (context.raw && context.endpoints.length > 0) {
    const routeWithoutQuery = normalized.route.split("?")[0];
    const allowed = context.endpoints.some((endpoint) => endpoint.route.split("?")[0] === routeWithoutQuery);
    if (!allowed) {
      if (context.providerHint?.modelFallbackAllowed) {
        warnings.push(`API route is not listed in this connection's AI Context; using ${context.providerHint.label} model/provider fallback: ${normalized.route}`);
      } else {
        errors.push(`API route is not listed in this connection's AI Context: ${normalized.route}`);
      }
    }
  }
  if (!context.raw) {
    if (context.providerHint?.modelFallbackAllowed) {
      warnings.push(`API AI Context is empty; using ${context.providerHint.label} model/provider fallback.`);
    } else {
      warnings.push("API AI Context is empty; generic API planning should ask for context before creating datasets.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    configuration: normalized,
  };
}

function rowsFromResponse(response, arrayPath = "root") {
  if (Array.isArray(response)) return response;
  if (!response || typeof response !== "object") return [];
  if (arrayPath === "root") return Array.isArray(response) ? response : [response];

  const value = arrayPath.split(".").reduce((acc, segment) => acc?.[segment], response);
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function getColumns(rows = []) {
  const sample = rows[0] || {};
  return Object.keys(sample).map((name) => ({
    name,
    type: typeof sample[name],
  }));
}

async function previewConfiguration({ connection, configuration, rowLimit = 25 } = {}) {
  const context = getContextSummary(connection);
  const dataRequest = normalizeDataRequest(configuration);
  const validation = validateConfiguration(dataRequest, { connection });
  if (!validation.valid) {
    return {
      status: "invalid",
      ...validation,
    };
  }

  const response = await apiProtocol.previewDataRequest({
    connection,
    dataRequest,
    itemsLimit: dataRequest.itemsLimit || rowLimit,
    items: dataRequest.items,
    offset: dataRequest.offset,
    pagination: dataRequest.pagination,
    paginationField: dataRequest.paginationField,
  });
  const rows = rowsFromResponse(response, context.arrayPath).slice(0, rowLimit);

  return {
    status: "ok",
    rows,
    columns: getColumns(rows),
    rowCount: rows.length,
    warnings: validation.warnings,
    chartSpec: buildChartSpec({
      question: "table",
      route: dataRequest.route,
      arrayPath: context.arrayPath,
      fields: context.fields,
    }),
  };
}

function getCapabilities({ connection } = {}) {
  const context = getContextSummary(connection);

  return {
    source: SOURCE_ID,
    instructions: SOURCE_INSTRUCTIONS,
    supports: {
      mode: "generic_rest_api",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      chartPlacement: true,
      templates: [],
    },
    context: {
      hasRawContext: Boolean(context.raw.trim()),
      endpoints: context.endpoints.slice(0, 10),
      arrayPath: context.arrayPath,
      fields: context.fields.slice(0, 20),
      ...getApiContextGuidance(connection),
      modelFallbackAllowed: Boolean(context.providerHint?.modelFallbackAllowed),
    },
    caveats: [
      "Prefer endpoints listed in AI Context or explicitly named by the user.",
      "For recognized provider hosts, model/provider knowledge can be used as fallback when AI Context is missing or incomplete.",
      "For unknown API hosts, ask for AI Context instead of inventing routes.",
      "Secrets should stay in authentication/headers, not in AI Context.",
    ],
  };
}

function listResources({ connection } = {}) {
  const context = getContextSummary(connection);

  return {
    source: SOURCE_ID,
    endpoints: context.endpoints,
    arrayPath: context.arrayPath,
    fields: context.fields,
    providerHint: context.providerHint,
    modelFallbackAllowed: Boolean(context.providerHint?.modelFallbackAllowed),
  };
}

function getSchema({ connection } = {}) {
  const resources = listResources({ connection });

  return {
    source: SOURCE_ID,
    entities: resources.endpoints.map((endpoint) => ({
      name: `${endpoint.method} ${endpoint.route}`,
      kind: "api_endpoint",
      columns: resources.fields.map((field) => ({ name: field, type: "unknown" })),
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
      message: "Choose an API route before fetching sample data.",
      requiredContext: ["resource"],
    };
  }

  return previewConfiguration({
    connection,
    configuration: {
      method: "GET",
      route: resource,
      itemsLimit: rowLimit,
      useGlobalHeaders: true,
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
