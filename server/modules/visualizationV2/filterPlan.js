const { resolveSelectorLegacyPath, toPlainObject } = require("./selectors");
const {
  buildVisualizationVariableContext,
  collectScopedFilterVariables,
  extractVariableName,
  resolveVisualizationVariableValue,
} = require("./variableResolution");
const { matchesScope } = require("./scopeMatching");

function buildFilterLookup(filters = []) {
  const lookup = new Map();

  filters.forEach((filter) => {
    [
      filter?.id,
      filter?.bindingId,
      filter?.filterId,
    ]
      .filter(Boolean)
      .forEach((key) => {
        if (!lookup.has(key)) {
          lookup.set(key, filter);
        }
      });
  });

  return lookup;
}

function buildScopedTarget(baseFilter = {}, target = {}, context = {}) {
  return {
    ...baseFilter,
    chartId: target.chartId || context.chart?.id || baseFilter.chartId || null,
    cdcId: target.cdcId || context.cdc?.id || baseFilter.cdcId || null,
    datasetId: target.datasetId || context.datasetOptions?.id || baseFilter.datasetId || null,
  };
}

function expandRuntimeFilterBindings(filters = [], context = {}) {
  const expandedFilters = [];

  (filters || []).forEach((filter) => {
    if (!Array.isArray(filter?.bindings) || filter.bindings.length === 0) {
      expandedFilters.push(filter);
      return;
    }

    filter.bindings.forEach((binding) => {
      if (!matchesScope(binding, context)) {
        return;
      }

      if (binding.targetType === "field") {
        expandedFilters.push(buildScopedTarget({
          ...filter,
          fieldId: binding.fieldId || filter.fieldId || null,
          operator: binding.operator || filter.operator || null,
          bindingId: binding.bindingId || filter.bindingId || null,
          filterId: filter.id || filter.filterId || null,
          id: binding.id || filter.id || null,
        }, binding, context));
        return;
      }

      if (
        binding.targetType === "questionFilter"
        || binding.targetType === "datasetFilter"
        || binding.targetType === "filter"
      ) {
        expandedFilters.push(buildScopedTarget({
          ...filter,
          id: binding.bindingId || binding.filterId || filter.id || null,
          bindingId: binding.bindingId || filter.bindingId || filter.id || null,
          filterId: binding.filterId || filter.id || null,
        }, binding, context));
      }
    });
  });

  return expandedFilters;
}

function shouldKeepConditionValue(condition = {}) {
  return condition.operator === "isNull"
    || condition.operator === "isNotNull"
    || condition.value === 0
    || condition.value === false
    || Boolean(condition.value);
}

function createSyntheticConditionId(prefix, baseId, suffix = "") {
  return [prefix, baseId, suffix].filter(Boolean).join("_");
}

function createConditionBase({
  field,
  id,
  operator,
  value,
  source,
  exposed = false,
  bindingId = null,
  filterId = null,
}) {
  return {
    id,
    field,
    operator,
    value,
    exposed,
    source,
    bindingId,
    filterId,
  };
}

function createRangeConditions({
  field,
  startDate,
  endDate,
  idPrefix,
  source,
  exposed = false,
  bindingId = null,
  filterId = null,
}) {
  const conditions = [];

  if (startDate || startDate === 0) {
    conditions.push(createConditionBase({
      id: createSyntheticConditionId(idPrefix, "start"),
      field,
      operator: "greaterOrEqual",
      value: startDate,
      source,
      exposed,
      bindingId,
      filterId,
    }));
  }

  if (endDate || endDate === 0) {
    conditions.push(createConditionBase({
      id: createSyntheticConditionId(idPrefix, "end"),
      field,
      operator: "lessOrEqual",
      value: endDate,
      source,
      exposed,
      bindingId,
      filterId,
    }));
  }

  return conditions;
}

function resolveQuestionFilterValue(filterDefinition = {}, filterLookup, variableContext = {}) {
  const valueSource = filterDefinition.valueSource || null;
  const variableName = filterDefinition.variableName || extractVariableName(filterDefinition.value);

  if (valueSource === "variable" || variableName) {
    return resolveVisualizationVariableValue(variableContext, variableName);
  }

  if (valueSource === "dashboardFilter" || valueSource === "chartFilter") {
    if (filterDefinition.bindingId && filterLookup.has(filterDefinition.bindingId)) {
      return filterLookup.get(filterDefinition.bindingId);
    }

    if (filterDefinition.id && filterLookup.has(filterDefinition.id)) {
      return filterLookup.get(filterDefinition.id);
    }

    return undefined;
  }

  return filterDefinition.value;
}

function compileQuestionFilter(filterDefinition = {}, context, filterLookup, variableContext = {}) {
  if (!filterDefinition || !matchesScope(filterDefinition, context)) {
    return [];
  }

  const field = resolveSelectorLegacyPath(filterDefinition, context.datasetOptions);
  if (!field) {
    return [];
  }

  const resolvedValue = resolveQuestionFilterValue(filterDefinition, filterLookup, variableContext);
  const baseId = filterDefinition.id || filterDefinition.bindingId || field;
  const source = "v2_question";

  if (
    filterDefinition.type === "date"
    || filterDefinition.operator === "between"
    || resolvedValue?.type === "date"
    || resolvedValue?.startDate
    || resolvedValue?.endDate
  ) {
    const startDate = resolvedValue?.startDate ?? filterDefinition.startDate ?? null;
    const endDate = resolvedValue?.endDate ?? filterDefinition.endDate ?? null;

    return createRangeConditions({
      field,
      startDate,
      endDate,
      idPrefix: createSyntheticConditionId(source, baseId),
      source,
      exposed: filterDefinition.exposed === true,
      bindingId: filterDefinition.bindingId || resolvedValue?.bindingId || null,
      filterId: filterDefinition.id || resolvedValue?.id || null,
    });
  }

  const normalizedValue = (
    resolvedValue
    && typeof resolvedValue === "object"
    && Object.prototype.hasOwnProperty.call(resolvedValue, "value")
  )
    ? resolvedValue.value
    : resolvedValue;

  const condition = createConditionBase({
    id: createSyntheticConditionId(source, baseId),
    field,
    operator: filterDefinition.operator || resolvedValue?.operator || "is",
    value: normalizedValue,
    source,
    exposed: filterDefinition.exposed === true,
    bindingId: filterDefinition.bindingId || null,
    filterId: filterDefinition.id || null,
  });

  return shouldKeepConditionValue(condition) ? [condition] : [];
}

function normalizeRuntimeFilter(filter = {}, context) {
  if (!filter || filter.type === "variable" || !matchesScope(filter, context)) {
    return [];
  }

  const source = "v2_runtime";
  const scopedFilter = {
    ...filter,
    chartId: context.chart?.id || filter.chartId || null,
    cdcId: context.cdc?.id || filter.cdcId || null,
    datasetId: context.datasetOptions?.id || filter.datasetId || null,
  };
  const explicitField = resolveSelectorLegacyPath(filter, context.datasetOptions);
  const baseId = filter.id || filter.bindingId || filter.filterId || explicitField || "runtime";

  if (filter.type === "date") {
    if (explicitField) {
      return createRangeConditions({
        field: explicitField,
        startDate: filter.startDate,
        endDate: filter.endDate,
        idPrefix: createSyntheticConditionId(source, baseId),
        source,
        bindingId: filter.bindingId || null,
        filterId: filter.id || filter.filterId || null,
      }).map((condition) => ({
        ...condition,
        chartId: scopedFilter.chartId,
        cdcId: scopedFilter.cdcId,
        datasetId: scopedFilter.datasetId,
      }));
    }

    if (scopedFilter.bindingId || scopedFilter.filterId) {
      return [];
    }

    if (!context.datasetOptions?.dateField) {
      return [];
    }

    return [{
      ...scopedFilter,
      field: context.datasetOptions.dateField,
    }];
  }

  if (!explicitField) {
    return [];
  }

  const normalizedFilter = {
    ...scopedFilter,
    field: explicitField,
  };

  if (shouldKeepConditionValue(normalizedFilter)) {
    return [normalizedFilter];
  }

  return [];
}

function getScopedRuntimeFilters(filters = [], chart = {}, datasetOptions = {}) {
  return filters.filter((filter) => {
    return matchesScope(filter, {
      chart,
      cdc: { id: datasetOptions?.cdcId || filter?.cdcId || null },
      datasetOptions,
    });
  });
}

function buildVisualizationFilterPlan({
  chart,
  datasets = [],
  filters = [],
  variables = {},
}) {
  const plainChart = toPlainObject(chart) || {};
  const runtimeFilters = [];

  const runtimeDatasets = datasets.map((dataset, index) => {
    const plainDataset = toPlainObject(dataset) || {};
    const datasetOptions = toPlainObject(plainDataset.options) || {};
    const cdc = plainChart.ChartDatasetConfigs?.[index] || {};
    const expandedScopedFilters = expandRuntimeFilterBindings(filters, {
      chart: plainChart,
      cdc,
      datasetOptions,
    });
    const filterLookup = buildFilterLookup([
      ...filters,
      ...expandedScopedFilters,
    ]);
    const scopedFilterVariables = collectScopedFilterVariables(filters, {
      chart: plainChart,
      cdc,
      datasetOptions,
    });
    const variableContext = buildVisualizationVariableContext({
      variables,
      filterVariables: scopedFilterVariables,
      cdc,
      datasetOptions,
    });
    const vizFilters = Array.isArray(cdc?.vizConfig?.filters) ? cdc.vizConfig.filters : [];
    const baseConditions = Array.isArray(datasetOptions.conditions)
      ? datasetOptions.conditions
      : [];
    const questionConditions = vizFilters.flatMap((filterDefinition) => {
      return compileQuestionFilter(filterDefinition, {
        chart: plainChart,
        cdc,
        datasetOptions,
      }, filterLookup, variableContext);
    });

    runtimeFilters.push(
      ...expandedScopedFilters.flatMap((filter) => normalizeRuntimeFilter(filter, {
        chart: plainChart,
        cdc,
        datasetOptions,
      })),
    );

    return {
      ...plainDataset,
      runtimeVariableContext: variableContext,
      runtimeVariables: variableContext.values,
      runtimeFilterPlan: {
        reusableConditions: [...baseConditions, ...questionConditions],
        runtimeVariables: variableContext.values,
        filterVariables: scopedFilterVariables,
        explicitBindingFilters: expandedScopedFilters
          .filter((filter) => Array.isArray(filter?.bindings)),
        pushdown: {
          variables: variableContext.values,
        },
      },
      options: {
        ...datasetOptions,
        conditions: [...baseConditions, ...questionConditions],
      },
    };
  });

  return {
    chart: plainChart,
    datasets: runtimeDatasets,
    filters: runtimeFilters,
  };
}

module.exports = {
  buildVisualizationFilterPlan,
  expandRuntimeFilterBindings,
  getScopedRuntimeFilters,
  matchesScope,
};
