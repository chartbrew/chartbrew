const { applyTransformation } = require("../../../dataTransformations");
const { buildAiVisualization } = require("../../../../visualization/aiVisualization");
const { VisualizationEngine } = require("../../../../visualization/VisualizationEngine");

function repairSourceDatasetIntent(source, payload) {
  const repair = source.backend?.ai?.repairDatasetIntent?.({
    name: payload.name,
    question: mergeQuestionContext(payload.question, payload.original_question, payload.name),
    configuration: payload.configuration,
  });

  if (!repair) {
    return {
      ...payload,
      intentRepair: null,
    };
  }

  if (!repair.validation?.valid) {
    throw new Error(repair.validation.errors.join(" "));
  }

  return {
    ...payload,
    configuration: repair.configuration || payload.configuration,
    spec: {
      ...(payload.spec || {}),
      ...(repair.chartSpec || {}),
    },
    intentRepair: repair.repaired
      ? {
        repaired: true,
        reason: repair.repairReason,
      }
      : null,
  };
}

function mergeQuestionContext(...values) {
  return values
    .filter(Boolean)
    .reduce((acc, value) => {
      if (acc.includes(value)) return acc;
      return acc ? `${acc}\n${value}` : value;
    }, "");
}

async function repairSourceDatasetIntentAsync(source, payload) {
  const repairedPayload = repairSourceDatasetIntent(source, payload);
  const configuration = repairedPayload.configuration || {};
  const validateConfiguration = source.backend?.ai?.validateConfiguration;
  const planDataset = source.backend?.ai?.planDataset;
  const canPlan = typeof planDataset === "function";
  const requiresDataRequestRoute = source.backend?.ai?.requiresDataRequestRoute === true;
  const requiresDataRequestQuery = source.backend?.ai?.requiresDataRequestQuery === true;
  const question = mergeQuestionContext(payload.question, payload.original_question, payload.name);

  if (!canPlan || !question) {
    return repairedPayload;
  }

  const hasRequiredRoute = !requiresDataRequestRoute || Boolean(payload.route || configuration.route);
  const hasRequiredQuery = !requiresDataRequestQuery || Boolean(payload.query || configuration.query);
  let shouldPlan = (!hasRequiredRoute || !hasRequiredQuery)
    || (Object.keys(configuration).length === 0 && !payload.route && !payload.query);
  if (!shouldPlan && typeof validateConfiguration === "function") {
    try {
      const validation = validateConfiguration({
        ...configuration,
        query: payload.query ?? configuration.query,
        method: payload.method ?? configuration.method,
        route: payload.route ?? configuration.route,
      }, {
        connection: payload.connection,
      });
      shouldPlan = validation && validation.valid === false;
    } catch {
      shouldPlan = false;
    }
  }

  if (!shouldPlan) {
    return repairedPayload;
  }

  const plan = await planDataset({
    connection: payload.connection,
    question,
    overrides: payload.overrides || {},
  });

  if (plan?.status !== "ok") {
    const options = Array.isArray(plan?.options) && plan.options.length > 0
      ? ` Options: ${plan.options.map((option) => option.label || option.value).join(", ")}.`
      : "";
    throw new Error(`${plan?.message || "Source configuration is incomplete."}${options}`);
  }

  return {
    ...repairedPayload,
    query: plan.query ?? plan.dataRequest?.query ?? repairedPayload.query ?? payload.query,
    method: plan.method ?? plan.dataRequest?.method ?? repairedPayload.method ?? payload.method,
    route: plan.route ?? plan.dataRequest?.route ?? repairedPayload.route ?? payload.route,
    itemsLimit: plan.itemsLimit ?? plan.dataRequest?.itemsLimit ?? repairedPayload.itemsLimit ?? payload.itemsLimit,
    conditions: plan.conditions ?? plan.dataRequest?.conditions ?? repairedPayload.conditions ?? payload.conditions,
    variables: plan.variables ?? plan.dataRequest?.variables ?? repairedPayload.variables ?? payload.variables,
    useGlobalHeaders: plan.useGlobalHeaders ?? plan.dataRequest?.useGlobalHeaders ?? repairedPayload.useGlobalHeaders ?? payload.useGlobalHeaders,
    headers: plan.headers ?? plan.dataRequest?.headers ?? repairedPayload.headers ?? payload.headers,
    body: plan.body ?? plan.dataRequest?.body ?? repairedPayload.body ?? payload.body,
    pagination: plan.pagination ?? plan.dataRequest?.pagination ?? repairedPayload.pagination ?? payload.pagination,
    items: plan.items ?? plan.dataRequest?.items ?? repairedPayload.items ?? payload.items,
    offset: plan.offset ?? plan.dataRequest?.offset ?? repairedPayload.offset ?? payload.offset,
    paginationField: plan.paginationField ?? plan.dataRequest?.paginationField ?? repairedPayload.paginationField ?? payload.paginationField,
    template: plan.template ?? plan.dataRequest?.template ?? repairedPayload.template ?? payload.template,
    configuration: plan.configuration || repairedPayload.configuration,
    spec: {
      ...(repairedPayload.spec || {}),
      ...(plan.chartSpec || {}),
    },
    intentRepair: {
      ...(repairedPayload.intentRepair || {}),
      planned: true,
      reason: "Filled missing or invalid source configuration with the source-owned planner.",
    },
  };
}

function isStripeCompiledMetricConfiguration(configuration) {
  return configuration?.source === "stripeOfficial"
    && configuration?.mode === "compiled_metric"
    && Boolean(configuration?.compiledMetric);
}

function removeCompiledMetricAccumulation({ configuration, type, subType, spec = {} }) {
  const chartType = type || spec.type;
  const requestedSubType = subType ?? spec.subType;

  if (
    isStripeCompiledMetricConfiguration(configuration)
    && chartType === "kpi"
    && requestedSubType === "AddTimeseries"
  ) {
    return {
      subType: undefined,
      spec: {
        ...spec,
        subType: undefined,
      },
      accumulationRemoved: true,
    };
  }

  return {
    subType,
    spec,
    accumulationRemoved: false,
  };
}

async function alignSourceChartBindings(source, payload = {}) {
  const align = source.backend?.ai?.alignChartBindings;
  if (typeof align !== "function") {
    return {
      xAxis: payload.xAxis,
      yAxis: payload.yAxis,
      dateField: payload.dateField,
    };
  }

  let rows = payload.rows;
  const previewConfiguration = source.backend?.ai?.previewConfiguration;
  if (!Array.isArray(rows) && typeof previewConfiguration === "function" && payload.connection) {
    const preview = await previewConfiguration({
      connection: payload.connection,
      configuration: payload.configuration,
      rowLimit: 25,
    });
    if (preview?.status !== "ok") throw new Error(preview?.message || "Check the source configuration and preview its data before creating a chart.");
    rows = preview.rows;
  }

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error("No rows are available for this chart. Check the query and date range before creating a preview.");
  }

  rows = applyTransformation(rows, payload.transform);
  const aligned = align({
    rows,
    type: payload.type,
    xAxis: payload.xAxis,
    yAxis: payload.yAxis,
    yAxisOperation: payload.yAxisOperation,
    dateField: payload.dateField,
    encoding: payload.encoding,
    visualization: payload.visualization,
  });
  const visualization = buildAiVisualization({
    chart: { ...payload.chartSpec, type: payload.type },
    cdc: { ...payload.chartSpec, ...aligned, yAxisOperation: payload.yAxisOperation, formula: payload.formula },
    encoding: payload.encoding,
    visualization: payload.visualization,
  });
  // Creation binds these layers to the single dataset; use the same binding for the sample.
  visualization.layers.forEach((layer) => { layer.bindingId = "binding-1"; });
  const { preparedData } = new VisualizationEngine({
    chart: { ...payload.chartSpec, type: payload.type, visualization },
    datasets: [{ data: rows, options: { id: "binding-1" } }],
  }).render();
  if (!preparedData.results.length || preparedData.results.some((result) => !result.rows.length
    || result.fields.filter((field) => field.role === "measure")
      .some((field) => !result.rows.some((row) => Number.isFinite(row[field.key]))))) {
    throw new Error("The chart preview has no usable values. Correct its query, output mapping, or chart fields and preview again before creating it.");
  }
  return {
    xAxis: aligned.xAxis ?? payload.xAxis,
    yAxis: aligned.yAxis ?? payload.yAxis,
    dateField: aligned.dateField ?? payload.dateField,
  };
}

module.exports = {
  alignSourceChartBindings,
  isStripeCompiledMetricConfiguration,
  removeCompiledMetricAccumulation,
  repairSourceDatasetIntent,
  repairSourceDatasetIntentAsync,
};
