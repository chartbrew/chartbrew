function repairSourceDatasetIntent(source, payload) {
  const repair = source.backend?.ai?.repairDatasetIntent?.({
    name: payload.name,
    question: payload.question,
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
  const question = mergeQuestionContext(payload.question, payload.original_question, payload.name);

  if (!canPlan || !question) {
    return repairedPayload;
  }

  let shouldPlan = Object.keys(configuration).length === 0
    || (requiresDataRequestRoute && !payload.route);
  if (!shouldPlan && typeof validateConfiguration === "function") {
    try {
      const validation = validateConfiguration(configuration, {
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
    method: plan.method ?? plan.dataRequest?.method ?? repairedPayload.method ?? payload.method,
    route: plan.route ?? plan.dataRequest?.route ?? repairedPayload.route ?? payload.route,
    itemsLimit: plan.itemsLimit ?? plan.dataRequest?.itemsLimit ?? repairedPayload.itemsLimit ?? payload.itemsLimit,
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
