const moment = require("moment-timezone");

const {
  COMPILED_METRICS,
  STRIPE_RESOURCES,
} = require("../stripeOfficial.resources");
const stripeOfficialProtocol = require("../stripeOfficial.protocol");

const SOURCE_ID = "stripeOfficial";
const DEFAULT_PAGINATION = { limit: 100, maxRecords: 1000 };

const TEMPLATE_RECOMMENDATIONS = [
  {
    terms: ["mrr", "arr", "arpa", "recurring", "subscription revenue"],
    templateSlugs: ["compiled-metrics"],
    chartIds: ["mrr", "arr", "arpa"],
  },
  {
    terms: ["churn", "cancel", "cancellation", "retention"],
    templateSlugs: ["compiled-metrics"],
    chartIds: ["gross-mrr-churn-rate", "net-mrr-churn-rate", "subscriber-churn-rate"],
  },
  {
    terms: ["cash", "cash flow", "fees", "net revenue", "payout"],
    templateSlugs: ["starter-metrics", "compiled-metrics"],
    chartIds: ["net-revenue-over-time", "stripe-fees-over-time", "net-cash-flow"],
  },
  {
    terms: ["payment", "payments", "failed", "succeeded", "success"],
    templateSlugs: ["starter-metrics"],
    chartIds: ["successful-payments-over-time", "failed-payments-over-time", "latest-payments-table"],
  },
  {
    terms: ["invoice", "invoices", "open invoices", "amount due"],
    templateSlugs: ["starter-metrics"],
    chartIds: ["open-invoices-table", "open-invoice-amount"],
  },
  {
    terms: ["refund", "refunds"],
    templateSlugs: ["starter-metrics"],
    chartIds: ["refunds-over-time"],
  },
];

const SOURCE_INSTRUCTIONS = [
  "Stripe Official is configuration-based. Return DataRequest.configuration objects; do not invent Stripe API routes.",
  "MRR, ARR, ARPA, churn rates, net cash flow, and customer lifetime value must use compiled_metric mode with the matching compiledMetric key. Never answer those with generic revenue, balance transaction, payment, invoice, or refund aggregates.",
  "Use balance_transactions for net revenue, fees, payouts, and cash-flow style questions.",
  "Use payment_intents for modern payment counts and payment status questions unless the user explicitly asks for charges.",
  "Stripe amounts are returned in minor currency units. Use chart formulas such as {val / 100} for currency metrics; do not hard-code a currency symbol.",
  "Use compiled_metric mode for MRR, ARR, ARPA, churn rates, net cash flow, and estimated customer lifetime value.",
  "Keep previews capped. Mention warnings when maxRecords is reached or when compiled metrics are first-pass estimates.",
  "Use create_temporary_chart by default. Use create_chart only when the user explicitly names a target dashboard/project.",
].join("\n");

const COMPILED_INTENT_RULES = [
  {
    id: "mrr",
    pattern: /\bmrr\b|monthly recurring revenue/i,
    expected: { mode: "compiled_metric", compiledMetric: "mrr" },
  },
  {
    id: "arr",
    pattern: /\barr\b|annual recurring revenue/i,
    expected: { mode: "compiled_metric", compiledMetric: "arr" },
  },
  {
    id: "arpa",
    pattern: /\barpa\b|average revenue per account|average revenue per customer/i,
    expected: { mode: "compiled_metric", compiledMetric: "arpa" },
  },
  {
    id: "gross_mrr_churn_rate",
    pattern: /gross mrr churn/i,
    expected: { mode: "compiled_metric", compiledMetric: "gross_mrr_churn_rate" },
  },
  {
    id: "net_mrr_churn_rate",
    pattern: /net mrr churn/i,
    expected: { mode: "compiled_metric", compiledMetric: "net_mrr_churn_rate" },
  },
  {
    id: "subscriber_churn_rate",
    pattern: /subscriber churn|customer churn|churn rate/i,
    expected: { mode: "compiled_metric", compiledMetric: "subscriber_churn_rate" },
  },
  {
    id: "net_cash_flow",
    pattern: /net cash flow|cash flow/i,
    expected: { mode: "compiled_metric", compiledMetric: "net_cash_flow" },
  },
  {
    id: "customer_lifetime_value",
    pattern: /customer lifetime value|\bltv\b/i,
    expected: { mode: "compiled_metric", compiledMetric: "customer_lifetime_value" },
  },
];

const ACCOUNTING_GRADE_PATTERN = /accounting-grade|audited|audit-ready|\bgaap\b|\bifrs\b|revenue recognition|recognized revenue/i;
const ACCOUNTING_GRADE_ERROR = "Stripe Official direct-API metrics are not accounting-grade. Refuse GAAP/IFRS, audited, or revenue-recognition claims and explain that Stripe Sigma, a warehouse, or accounting system reconciliation is required.";

function getCapabilities() {
  return {
    source: SOURCE_ID,
    instructions: SOURCE_INSTRUCTIONS,
    supports: {
      modes: ["aggregate", "raw", "compiled_metric"],
      queryModes: ["list"],
      variables: true,
      pagination: true,
      templates: ["starter-metrics", "compiled-metrics"],
      chartPlacement: true,
    },
    resources: Object.keys(STRIPE_RESOURCES),
    compiledMetrics: Object.keys(COMPILED_METRICS),
    caveats: [
      "Stripe Search API is intentionally excluded from AI planning until a guarded query builder is available.",
      "Currency metrics use Stripe minor units and need display formulas for major-unit presentation.",
      "Compiled subscription metrics are direct-API estimates, not accounting-grade revenue recognition.",
    ],
  };
}

function listResources() {
  return {
    source: SOURCE_ID,
    resources: Object.entries(STRIPE_RESOURCES).map(([id, resource]) => ({
      id,
      label: resource.label,
      dateFields: resource.dateFields,
      defaultDateField: resource.defaultDateField,
      metrics: resource.metrics,
      dimensions: resource.dimensions,
      filters: resource.filters,
      supportedQueryModes: resource.supportedQueryModes.filter((mode) => mode !== "search"),
      rawColumns: resource.rawColumns,
    })),
    compiledMetrics: Object.entries(COMPILED_METRICS).map(([id, metric]) => ({
      id,
      ...metric,
    })),
  };
}

function getSchema() {
  const resources = listResources().resources.map((resource) => ({
    name: resource.id,
    label: resource.label,
    kind: "stripe_resource",
    columns: Array.from(new Set([
      ...resource.rawColumns,
      ...resource.dateFields,
      ...resource.metrics.map((metric) => metric.field).filter(Boolean),
      ...resource.dimensions.map((dimension) => dimension.field).filter(Boolean),
    ])).map((name) => ({ name, type: inferFieldType(name, resource) })),
    metrics: resource.metrics,
    dimensions: resource.dimensions,
    filters: resource.filters,
    supportedQueryModes: resource.supportedQueryModes,
  }));

  const compiledMetrics = Object.entries(COMPILED_METRICS).map(([id, metric]) => ({
    name: id,
    label: metric.label,
    kind: "stripe_compiled_metric",
    columns: [
      { name: "period", type: "date" },
      { name: "dimension", type: "string" },
      { name: "value", type: "number" },
      { name: "currency", type: "string" },
      { name: "recordsProcessed", type: "number" },
    ],
    ...metric,
  }));

  return {
    source: SOURCE_ID,
    entities: [...resources, ...compiledMetrics],
  };
}

function inferFieldType(field, resource) {
  if (resource.dateFields.includes(field)) return "date";
  if (["amount", "amount_received", "amount_paid", "amount_due", "fee", "net", "value"].includes(field)) return "number";
  if (field === "cancel_at_period_end") return "boolean";
  return "string";
}

function getTemplates() {
  const { listTemplates } = require("../../../shared/templates/chartTemplateLoader"); // eslint-disable-line global-require

  return {
    source: SOURCE_ID,
    templates: listTemplates(SOURCE_ID),
  };
}

function recommendTemplates({ question = "" } = {}) {
  const normalizedQuestion = question.toLowerCase();
  const matches = TEMPLATE_RECOMMENDATIONS.filter((recommendation) => {
    return recommendation.terms.some((term) => normalizedQuestion.includes(term));
  });
  const selected = matches.length > 0
    ? matches
    : [{
      templateSlugs: ["starter-metrics"],
      chartIds: ["net-revenue-over-time", "successful-payments-over-time"],
      terms: [],
    }];
  const templateSlugs = Array.from(new Set(selected.flatMap((match) => match.templateSlugs)));
  const chartIds = Array.from(new Set(selected.flatMap((match) => match.chartIds)));

  return {
    source: SOURCE_ID,
    question,
    recommendations: getTemplates().templates
      .filter((template) => templateSlugs.includes(template.slug))
      .map((template) => ({
        ...template,
        recommendedCharts: template.charts.filter((chart) => chartIds.includes(chart.id)),
      })),
  };
}

function normalizeDateRange(question, overrides = {}) {
  if (overrides.dateRange) {
    return {
      field: overrides.dateRange.field || "created",
      start: overrides.dateRange.start || "last_12_months",
      end: overrides.dateRange.end || "now",
    };
  }

  const normalizedQuestion = question.toLowerCase();
  if (normalizedQuestion.includes("last month")) {
    const previousMonth = moment().subtract(1, "month");
    return {
      field: "created",
      start: previousMonth.clone().startOf("month").format("YYYY-MM-DD"),
      end: previousMonth.clone().endOf("month").format("YYYY-MM-DD"),
    };
  }
  if (normalizedQuestion.includes("today")) {
    return {
      field: "created",
      start: moment().startOf("day").format("YYYY-MM-DD"),
      end: "now",
    };
  }
  if (normalizedQuestion.includes("yesterday")) {
    const yesterday = moment().subtract(1, "day");
    return {
      field: "created",
      start: yesterday.clone().startOf("day").format("YYYY-MM-DD"),
      end: yesterday.clone().endOf("day").format("YYYY-MM-DD"),
    };
  }

  const daysMatch = normalizedQuestion.match(/last\s+(\d+)\s+days?/);
  if (daysMatch) {
    return {
      field: "created",
      start: `last_${daysMatch[1]}_days`,
      end: "now",
    };
  }

  const monthsMatch = normalizedQuestion.match(/last\s+(\d+)\s+months?/);
  if (monthsMatch) {
    return {
      field: "created",
      start: `last_${monthsMatch[1]}_months`,
      end: "now",
    };
  }

  return {
    field: "created",
    start: "last_12_months",
    end: "now",
  };
}

function normalizeInterval(question, mode) {
  const normalizedQuestion = question.toLowerCase();
  if (normalizedQuestion.includes("year")) return "year";
  if (normalizedQuestion.includes("week")) return "week";
  if (normalizedQuestion.includes("month") || mode === "compiled_metric") return "month";
  return "day";
}

function resolvePlanIntent(question, overrides = {}) {
  const normalizedQuestion = question.toLowerCase();
  if (overrides.resource) {
    return {
      mode: overrides.mode || "aggregate",
      resource: overrides.resource,
      metric: overrides.metric || { operation: "count" },
    };
  }
  if (normalizedQuestion.includes("net mrr churn")) return { mode: "compiled_metric", compiledMetric: "net_mrr_churn_rate" };
  if (normalizedQuestion.includes("gross mrr churn")) return { mode: "compiled_metric", compiledMetric: "gross_mrr_churn_rate" };
  if (normalizedQuestion.includes("subscriber churn") || normalizedQuestion.includes("customer churn")) return { mode: "compiled_metric", compiledMetric: "subscriber_churn_rate" };
  if (overrides.compiledMetric || normalizedQuestion.includes("mrr")) return { mode: "compiled_metric", compiledMetric: overrides.compiledMetric || "mrr" };
  if (normalizedQuestion.includes("arr")) return { mode: "compiled_metric", compiledMetric: "arr" };
  if (normalizedQuestion.includes("arpa")) return { mode: "compiled_metric", compiledMetric: "arpa" };
  if (normalizedQuestion.includes("cash flow")) return { mode: "compiled_metric", compiledMetric: "net_cash_flow" };
  if (normalizedQuestion.includes("lifetime value") || normalizedQuestion.includes("ltv")) return { mode: "compiled_metric", compiledMetric: "customer_lifetime_value" };

  if (overrides.mode === "raw" || normalizedQuestion.includes("table") || normalizedQuestion.includes("latest")) {
    if (normalizedQuestion.includes("invoice")) return { mode: "raw", resource: "invoices" };
    if (normalizedQuestion.includes("subscription")) return { mode: "raw", resource: "subscriptions" };
    if (normalizedQuestion.includes("refund")) return { mode: "raw", resource: "refunds" };
    return { mode: "raw", resource: "payment_intents" };
  }

  if (normalizedQuestion.includes("refund")) {
    return { mode: "aggregate", resource: "refunds", metric: { field: "amount", operation: "sum" } };
  }
  if (normalizedQuestion.includes("fee")) {
    return { mode: "aggregate", resource: "balance_transactions", metric: { field: "fee", operation: "sum" } };
  }
  if (normalizedQuestion.includes("gross revenue") || normalizedQuestion.includes("gross")) {
    return { mode: "aggregate", resource: "balance_transactions", metric: { field: "amount", operation: "sum" }, filters: [{ field: "type", operator: "is", value: "charge" }] };
  }
  if (normalizedQuestion.includes("net revenue") || normalizedQuestion.includes("revenue")) {
    return { mode: "aggregate", resource: "balance_transactions", metric: { field: "net", operation: "sum" }, filters: [{ field: "type", operator: "is", value: "charge" }] };
  }
  if (normalizedQuestion.includes("failed")) {
    return { mode: "aggregate", resource: "payment_intents", metric: { operation: "count" }, filters: [{ field: "status", operator: "is", value: "requires_payment_method" }] };
  }
  if (normalizedQuestion.includes("payment")) {
    return { mode: "aggregate", resource: "payment_intents", metric: { operation: "count" }, filters: [{ field: "status", operator: "is", value: "succeeded" }] };
  }
  if (normalizedQuestion.includes("subscription")) {
    return { mode: "aggregate", resource: "subscriptions", metric: { operation: "count" }, filters: [{ field: "status", operator: "is", value: "active" }] };
  }
  if (normalizedQuestion.includes("invoice")) {
    return { mode: "aggregate", resource: "invoices", metric: { field: "amount_due", operation: "sum" }, filters: [{ field: "status", operator: "is", value: "open" }] };
  }

  return { mode: "aggregate", resource: "balance_transactions", metric: { field: "net", operation: "sum" }, filters: [{ field: "type", operator: "is", value: "charge" }] };
}

function getOutputFields(config) {
  if (config.mode === "raw") {
    const resource = STRIPE_RESOURCES[config.resource];
    return (config.rawColumns || resource.rawColumns || []).map((field) => `root[].${field.replace(/\./g, "_")}`);
  }

  return ["root[].period", "root[].dimension", "root[].value", "root[].currency", "root[].recordsProcessed"];
}

function getDisplayFormula(config) {
  if (config.mode === "compiled_metric") {
    const metric = COMPILED_METRICS[config.compiledMetric];
    if (metric?.output === "ratio") return "{val * 100}%";
    if (metric?.output === "currency") return "{val / 100}";
    return undefined;
  }

  const resource = STRIPE_RESOURCES[config.resource];
  const metric = resource?.metrics.find((candidate) => {
    return candidate.field === config.metric?.field && candidate.operation === config.metric?.operation;
  });
  return metric?.type === "currency" ? "{val / 100}" : undefined;
}

function getChartSpec(config, question) {
  if (config.mode === "raw") {
    const outputFields = getOutputFields(config);
    return {
      type: "table",
      title: makeTitle(question, config),
      xAxis: outputFields[0],
      yAxis: outputFields.find((field) => /amount|value|net|fee|due|paid/.test(field)) || outputFields[0],
      yAxisOperation: "none",
      columnsOrder: outputFields,
      maxRecords: Math.min(config.pagination?.maxRecords || 100, 100),
      legend: makeLegend(config),
    };
  }

  const asksForTrend = /\bover time\b|\btrend\b|\bby\s+(day|week|month|year)\b|\blast\s+\d+\s+(days?|weeks?|months?|years?)\b/i.test(question);
  const asksForKpi = /\bkpi\b|\bcurrent\b|\blatest\b/i.test(question);
  const hasExplicitDateWindow = /^\d{4}-\d{2}-\d{2}/.test(String(config.dateRange?.start || ""))
    && /^\d{4}-\d{2}-\d{2}/.test(String(config.dateRange?.end || ""));
  const isSinglePeriod = asksForKpi || (hasExplicitDateWindow && !asksForTrend);
  const metricOutput = config.mode === "compiled_metric" ? COMPILED_METRICS[config.compiledMetric]?.output : null;
  return {
    type: isSinglePeriod ? "kpi" : "line",
    title: makeTitle(question, config),
    subType: isSinglePeriod && config.mode !== "compiled_metric" ? "AddTimeseries" : undefined,
    xAxis: config.mode === "compiled_metric"
      || config.dimension?.field === "period"
      || config.dimension?.field === "created"
      || config.dimension?.type === "date"
      ? "root[].period"
      : "root[].dimension",
    yAxis: "root[].value",
    yAxisOperation: "none",
    timeInterval: config.dimension?.interval || "day",
    pointRadius: 0,
    includeZeros: true,
    legend: makeLegend(config),
    formula: getDisplayFormula(config),
    configuration: metricOutput ? { output: metricOutput } : {},
  };
}

function makeTitle(question, config) {
  const normalizedQuestion = String(question || "").trim();
  if (normalizedQuestion) {
    return normalizedQuestion.charAt(0).toUpperCase() + normalizedQuestion.slice(1).replace(/[?.!]+$/, "");
  }

  if (config.mode === "compiled_metric") return COMPILED_METRICS[config.compiledMetric]?.label || "Stripe metric";
  return STRIPE_RESOURCES[config.resource]?.label || "Stripe metric";
}

function makeLegend(config) {
  if (config.mode === "compiled_metric") return COMPILED_METRICS[config.compiledMetric]?.label || "Value";
  if (config.metric?.operation === "count") return "Count";
  const metric = STRIPE_RESOURCES[config.resource]?.metrics.find((candidate) => {
    return candidate.field === config.metric?.field && candidate.operation === config.metric?.operation;
  });
  return metric?.label || "Value";
}

function validateConfiguration(configuration) {
  const validation = stripeOfficialProtocol.validateConfiguration({
    ...(configuration || {}),
    pagination: {
      ...DEFAULT_PAGINATION,
      ...(configuration?.pagination || {}),
    },
  }, { allowSearch: false });
  const maxRecords = Number(validation.configuration.pagination?.maxRecords);

  return {
    ...validation,
    warnings: [
      ...validation.warnings,
      ...(maxRecords > 5000
        ? ["pagination.maxRecords will be capped by the Stripe protocol. Use smaller previews for AI tool calls."]
        : []),
    ],
  };
}

function validateDatasetIntent({ name = "", question = "", configuration = {} } = {}) {
  const intentText = [name, question].filter(Boolean).join(" ");
  if (ACCOUNTING_GRADE_PATTERN.test(intentText)) {
    return {
      valid: false,
      errors: [ACCOUNTING_GRADE_ERROR],
      warnings: [],
    };
  }

  const matchedRule = COMPILED_INTENT_RULES.find((rule) => rule.pattern.test(intentText));

  if (!matchedRule) {
    return {
      valid: true,
      errors: [],
      warnings: [],
    };
  }

  const usesExpectedCompiledMetric = configuration?.mode === matchedRule.expected.mode
    && configuration?.compiledMetric === matchedRule.expected.compiledMetric;

  if (usesExpectedCompiledMetric) {
    return {
      valid: true,
      errors: [],
      warnings: [],
      expected: matchedRule.expected,
    };
  }

  return {
    valid: false,
    errors: [
      `${matchedRule.id} requests must use Stripe Official compiled_metric mode with compiledMetric=${matchedRule.expected.compiledMetric}. Do not use generic revenue or balance transaction aggregates for this metric.`,
    ],
    warnings: [],
    expected: matchedRule.expected,
  };
}

function repairDatasetIntent({ name = "", question = "", configuration = {} } = {}) {
  const validation = validateDatasetIntent({ name, question, configuration });
  if (validation.valid || !validation.expected?.compiledMetric) {
    return {
      repaired: false,
      configuration,
      validation,
    };
  }

  const plan = planDataset({
    question: question || name,
    overrides: {
      compiledMetric: validation.expected.compiledMetric,
      currency: configuration.currency,
      dateRange: configuration.dateRange,
      pagination: configuration.pagination,
    },
  });

  return {
    repaired: true,
    configuration: plan.configuration,
    chartSpec: plan.chartSpec,
    validation: validateDatasetIntent({
      name,
      question,
      configuration: plan.configuration,
    }),
    repairReason: validation.errors[0],
  };
}

function planDataset({ question = "", overrides = {} } = {}) {
  if (ACCOUNTING_GRADE_PATTERN.test(question)) {
    return {
      status: "invalid",
      source: SOURCE_ID,
      datasetName: makeTitle(question, { resource: "balance_transactions" }),
      configuration: {
        ...stripeOfficialProtocol.DEFAULT_CONFIGURATION,
        source: SOURCE_ID,
      },
      chartSpec: {},
      outputFields: [],
      warnings: [],
      errors: [ACCOUNTING_GRADE_ERROR],
      rationale: {
        intent: "unsupported_accounting_grade_claim",
      },
    };
  }

  const intent = resolvePlanIntent(question, overrides);
  const interval = normalizeInterval(question, intent.mode);
  const dateRange = normalizeDateRange(question, overrides);
  const filters = [
    ...(intent.filters || []),
    ...(overrides.filters || []),
  ];
  const baseConfiguration = {
    ...stripeOfficialProtocol.DEFAULT_CONFIGURATION,
    source: SOURCE_ID,
    mode: intent.mode,
    resource: intent.resource || "balance_transactions",
    queryMode: "list",
    dateRange: {
      ...dateRange,
      field: overrides.dateRange?.field || dateRange.field || "created",
    },
    filters,
    pagination: {
      ...DEFAULT_PAGINATION,
      ...(overrides.pagination || {}),
    },
  };
  const configuration = intent.mode === "compiled_metric"
    ? {
      ...baseConfiguration,
      compiledMetric: intent.compiledMetric,
      calculationVersion: COMPILED_METRICS[intent.compiledMetric]?.calculationVersion || 1,
      inputs: COMPILED_METRICS[intent.compiledMetric]?.inputs || [],
      dimension: {
        field: "period",
        interval,
      },
      currency: overrides.currency || "auto",
    }
    : {
      ...baseConfiguration,
      metric: overrides.metric || intent.metric || { operation: "count" },
      dimension: overrides.dimension || {
        field: dateRange.field || STRIPE_RESOURCES[intent.resource]?.defaultDateField || "created",
        type: "date",
        interval,
      },
      rawColumns: intent.mode === "raw" ? STRIPE_RESOURCES[intent.resource]?.rawColumns : undefined,
    };
  const validation = validateConfiguration(configuration);
  const chartSpec = getChartSpec(validation.configuration, question);

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
      intent,
      resource: validation.configuration.resource,
      mode: validation.configuration.mode,
      metric: validation.configuration.mode === "compiled_metric"
        ? validation.configuration.compiledMetric
        : validation.configuration.metric,
    },
  };
}

async function previewConfiguration({ connection, configuration, rowLimit = 25 } = {}) {
  const validation = validateConfiguration(configuration);
  if (!validation.valid) {
    return {
      status: "invalid",
      ...validation,
    };
  }

  const previewConfig = {
    ...validation.configuration,
    pagination: {
      ...validation.configuration.pagination,
      maxRecords: Math.min(Number(validation.configuration.pagination?.maxRecords || rowLimit), rowLimit),
    },
  };
  const dataRequest = {
    id: null,
    query: null,
    configuration: previewConfig,
  };
  const result = await stripeOfficialProtocol.previewDataRequest({
    connection,
    dataRequest,
    getCache: false,
  });
  const rows = result.responseData?.data || [];
  const columns = rows[0]
    ? Object.keys(rows[0]).map((name) => ({ name, type: typeof rows[0][name] }))
    : getOutputFields(previewConfig).map((field) => ({
      name: field.replace("root[].", ""),
      type: field === "root[].value" ? "number" : "string",
    }));

  return {
    status: "ok",
    rows: rows.slice(0, rowLimit),
    columns,
    rowCount: rows.length,
    warnings: [
      ...validation.warnings,
      ...(result.responseData?.configuration?.warnings || []),
    ],
    chartSpec: getChartSpec(previewConfig, ""),
  };
}

async function getSampleData({ connection, resource = "balance_transactions", rowLimit = 5 } = {}) {
  const plan = planDataset({
    question: `latest ${resource} table`,
    overrides: {
      mode: "raw",
      pagination: { maxRecords: rowLimit },
    },
  });
  plan.configuration.resource = resource;
  plan.configuration.rawColumns = STRIPE_RESOURCES[resource]?.rawColumns || [];
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
  repairDatasetIntent,
  validateConfiguration,
  validateDatasetIntent,
};
