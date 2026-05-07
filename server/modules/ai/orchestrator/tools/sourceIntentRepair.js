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
};
