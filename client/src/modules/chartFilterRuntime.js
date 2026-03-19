function hasDefinedValue(value) {
  return value === 0 || value === false || Boolean(value);
}

export function upsertChartCondition(conditions = [], condition = {}) {
  const normalizedConditions = Array.isArray(conditions) ? [...conditions] : [];
  const conditionIndex = normalizedConditions.findIndex((currentCondition) => currentCondition?.id === condition?.id);

  if (conditionIndex > -1) {
    normalizedConditions[conditionIndex] = condition;
    return normalizedConditions;
  }

  return [...normalizedConditions, condition];
}

export function removeChartCondition(conditions = [], conditionOrId = null) {
  const targetId = typeof conditionOrId === "object" ? conditionOrId?.id : conditionOrId;

  if (!targetId) {
    return Array.isArray(conditions) ? [...conditions] : [];
  }

  return (conditions || []).filter((condition) => condition?.id !== targetId);
}

export function mergeChartFilters(storedFilters = [], inlineFilters = []) {
  const normalizedStoredFilters = Array.isArray(storedFilters) ? storedFilters : [];
  const normalizedInlineFilters = Array.isArray(inlineFilters) ? inlineFilters : [];
  const inlineFilterIds = new Set(
    normalizedInlineFilters
      .filter((filter) => filter?.id)
      .map((filter) => filter.id)
  );

  return [
    ...normalizedStoredFilters.filter((filter) => !inlineFilterIds.has(filter?.id)),
    ...normalizedInlineFilters,
  ];
}

export function buildChartFilterRequest({
  storedFilters = [],
  inlineFilters = [],
  chartId = null,
}) {
  const allFilters = mergeChartFilters(storedFilters, inlineFilters);
  const variables = {};

  allFilters
    .filter((filter) => filter?.type === "variable" && filter.variable && hasDefinedValue(filter.value))
    .forEach((filter) => {
      variables[filter.variable] = filter.value;
    });

  const applicableFilters = allFilters
    .filter((filter) => filter?.type !== "variable")
    .filter((filter) => {
      if (filter?.type === "date" && Array.isArray(filter.charts) && filter.charts.length > 0 && chartId !== null) {
        return filter.charts.includes(chartId);
      }

      return true;
    });

  return {
    allFilters,
    applicableFilters,
    variables,
  };
}

export function shouldRunFilterRequest({ filters = [], variables = {} } = {}) {
  return (filters || []).length > 0 || Object.keys(variables || {}).length > 0;
}
