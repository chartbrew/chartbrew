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

module.exports = {
  isStripeCompiledMetricConfiguration,
  removeCompiledMetricAccumulation,
  repairSourceDatasetIntent,
  repairSourceDatasetIntentAsync,
};
