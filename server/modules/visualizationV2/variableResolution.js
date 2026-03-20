const { toPlainObject } = require("./selectors");
const { matchesScope } = require("./scopeMatching");

function extractVariableName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/\{\{\s*([^}]+?)\s*\}\}/);
  return match?.[1] || null;
}

function unwrapResolvedVariableValue(value) {
  if (
    value
    && typeof value === "object"
    && Object.prototype.hasOwnProperty.call(value, "value")
  ) {
    return value.value;
  }

  return value;
}

function hasResolvedVariableValue(value) {
  const unwrappedValue = unwrapResolvedVariableValue(value);
  return unwrappedValue !== null && unwrappedValue !== undefined && unwrappedValue !== "";
}

function normalizeBindingDefaultValue(binding = {}) {
  if (!hasResolvedVariableValue(binding?.default_value)) {
    return undefined;
  }

  switch (binding.type) {
    case "number":
      return Number.isNaN(Number(binding.default_value)) ? 0 : Number(binding.default_value);
    case "boolean":
      return binding.default_value === true || binding.default_value === "true";
    case "date":
      return String(binding.default_value);
    case "string":
    default:
      return String(binding.default_value);
  }
}

function collectRequestVariableBindings(datasetOptions = {}) {
  const plainDatasetOptions = toPlainObject(datasetOptions) || {};
  const dataRequests = Array.isArray(plainDatasetOptions.DataRequests)
    ? plainDatasetOptions.DataRequests
    : [];

  return dataRequests.flatMap((dataRequest) => {
    const plainDataRequest = toPlainObject(dataRequest) || {};
    return Array.isArray(plainDataRequest.VariableBindings)
      ? plainDataRequest.VariableBindings.map((binding) => toPlainObject(binding) || {})
      : [];
  });
}

function getFilterBoundVariableValue(filter = {}, binding = {}) {
  if (filter?.type === "date") {
    if (binding.role === "start") {
      return filter.startDate;
    }

    if (binding.role === "end") {
      return filter.endDate;
    }

    return undefined;
  }

  return filter?.value;
}

function collectScopedFilterVariables(filters = [], context = {}) {
  const scopedVariables = {};

  (filters || []).forEach((filter) => {
    if (!Array.isArray(filter?.bindings) || filter.bindings.length === 0) {
      return;
    }

    filter.bindings.forEach((binding) => {
      if (binding?.targetType !== "variable" || !binding?.variableName) {
        return;
      }

      if (!matchesScope(binding, context)) {
        return;
      }

      const value = getFilterBoundVariableValue(filter, binding);
      if (hasResolvedVariableValue(value)) {
        scopedVariables[binding.variableName] = unwrapResolvedVariableValue(value);
      }
    });
  });

  return scopedVariables;
}

function setResolvedVariable(context, name, value, source, binding = null) {
  if (!name || !hasResolvedVariableValue(value)) {
    return;
  }

  context.values[name] = unwrapResolvedVariableValue(value);
  context.meta[name] = {
    source,
    type: binding?.type || context.meta[name]?.type || null,
    required: binding?.required === true,
    entityType: binding?.entity_type || null,
  };
}

function buildVisualizationVariableContext({
  variables = {},
  filterVariables = {},
  cdc = {},
  datasetOptions = {},
}) {
  const context = {
    values: {},
    meta: {},
  };
  const plainVariables = variables && typeof variables === "object" ? variables : {};
  const plainDatasetOptions = toPlainObject(datasetOptions) || {};
  const datasetBindings = Array.isArray(plainDatasetOptions.VariableBindings)
    ? plainDatasetOptions.VariableBindings.map((binding) => toPlainObject(binding) || {})
    : [];
  const requestBindings = collectRequestVariableBindings(plainDatasetOptions);
  const configuredVariables = Array.isArray(cdc?.configuration?.variables)
    ? cdc.configuration.variables
    : [];

  datasetBindings.forEach((binding) => {
    setResolvedVariable(
      context,
      binding.name,
      normalizeBindingDefaultValue(binding),
      "dataset_default",
      binding,
    );
  });

  requestBindings.forEach((binding) => {
    setResolvedVariable(
      context,
      binding.name,
      normalizeBindingDefaultValue(binding),
      "request_default",
      binding,
    );
  });

  configuredVariables.forEach((configVar) => {
    setResolvedVariable(
      context,
      configVar.name,
      configVar.value,
      "cdc_default",
      null,
    );
  });

  Object.entries(filterVariables && typeof filterVariables === "object" ? filterVariables : {}).forEach(([name, value]) => {
    setResolvedVariable(context, name, value, "filter_binding", null);
  });

  Object.entries(plainVariables).forEach(([name, value]) => {
    setResolvedVariable(context, name, value, "runtime", null);
  });

  return context;
}

function resolveVisualizationVariableValue(variableContext = {}, variableName) {
  if (!variableName) {
    return undefined;
  }

  return variableContext?.values?.[variableName];
}

module.exports = {
  buildVisualizationVariableContext,
  collectScopedFilterVariables,
  collectRequestVariableBindings,
  extractVariableName,
  getFilterBoundVariableValue,
  hasResolvedVariableValue,
  normalizeBindingDefaultValue,
  resolveVisualizationVariableValue,
  unwrapResolvedVariableValue,
};
