function hasDefinedValue(value) {
  return value === 0 || value === false || Boolean(value);
}

function hasFieldFilterValue(filter = {}) {
  if (filter.operator === "isNull" || filter.operator === "isNotNull") {
    return true;
  }

  return hasDefinedValue(filter.value);
}

function hasDateFilterValue(filter = {}) {
  return hasDefinedValue(filter.startDate) || hasDefinedValue(filter.endDate);
}

function hasVariableFilterValue(filter = {}) {
  return hasDefinedValue(filter.value);
}

function getFilterKey(filter = {}) {
  return filter.id || filter.variable || filter.field || null;
}

function getChartFieldTargets(chart = {}) {
  const targets = [];

  (chart?.ChartDatasetConfigs || []).forEach((cdc) => {
    const dataset = cdc?.Dataset || {};

    if (Array.isArray(dataset?.fieldsMetadata) && dataset.fieldsMetadata.length > 0) {
      dataset.fieldsMetadata.forEach((field) => {
        targets.push({
          chartId: chart.id,
          cdcId: cdc.id,
          datasetId: dataset.id || cdc.dataset_id || null,
          fieldId: field?.id || field?.legacyPath || null,
          legacyPath: field?.legacyPath || field?.id || null,
          type: field?.type || null,
        });
      });
      return;
    }

    if (dataset?.fieldsSchema && typeof dataset.fieldsSchema === "object") {
      Object.keys(dataset.fieldsSchema).forEach((fieldPath) => {
        targets.push({
          chartId: chart.id,
          cdcId: cdc.id,
          datasetId: dataset.id || cdc.dataset_id || null,
          fieldId: fieldPath,
          legacyPath: fieldPath,
          type: dataset.fieldsSchema[fieldPath] || null,
        });
      });
    }
  });

  return targets;
}

function matchesBindingScope(binding = {}, chart = {}) {
  if (!binding || (binding?.targetType !== "field" && binding?.targetType !== "questionFilter")) {
    return false;
  }

  if (binding.chartId && `${binding.chartId}` !== `${chart?.id}`) {
    return false;
  }

  return true;
}

function getMatchingTargetBindings(filter = {}, chart = {}) {
  if (!Array.isArray(filter?.bindings) || filter.bindings.length === 0) {
    return [];
  }

  return filter.bindings.filter((binding) => matchesBindingScope(binding, chart));
}

function chartContainsFilterTarget(chart = {}, filter = {}) {
  const chartFieldTargets = getChartFieldTargets(chart);

  if (chartFieldTargets.some((target) => {
    return (
      (filter?.fieldId && `${target.fieldId}` === `${filter.fieldId}`)
      || (filter?.field && `${target.legacyPath}` === `${filter.field}`)
    );
  })) {
    return true;
  }

  return (chart?.ChartDatasetConfigs || []).some((cdc) => {
    return (cdc?.Dataset?.conditions || []).some((condition) => {
      return (
        (filter?.fieldId && `${condition?.field}` === `${filter.fieldId}`)
        || (filter?.field && `${condition?.field}` === `${filter.field}`)
      );
    });
  });
}

function normalizeFilterForChart(filter = {}, chart = {}) {
  const matchingBindings = getMatchingTargetBindings(filter, chart);

  if (matchingBindings.length === 0) {
    return filter;
  }

  const primaryBinding = matchingBindings[0];

  return {
    ...filter,
    chartId: primaryBinding.chartId || chart?.id || null,
    cdcId: primaryBinding.cdcId || filter?.cdcId || null,
    datasetId: primaryBinding.datasetId || filter?.datasetId || null,
    targetType: primaryBinding.targetType || filter?.targetType || "field",
    fieldId: primaryBinding.fieldId || filter?.fieldId || null,
    field: primaryBinding.legacyPath || filter?.field || null,
    operator: primaryBinding.operator || filter?.operator || null,
    bindingId: primaryBinding.bindingId || filter?.bindingId || null,
    filterId: primaryBinding.filterId || filter?.filterId || filter?.id || null,
  };
}

function filterAppliesToChart(filter = {}, chart = {}) {
  if (!filter || filter?.type === "variable") {
    return false;
  }

  const matchingBindings = getMatchingTargetBindings(filter, chart);
  if (matchingBindings.length > 0) {
    return true;
  }

  if (Array.isArray(filter?.bindings) && filter.bindings.length > 0) {
    return false;
  }

  if (Array.isArray(filter?.charts) && filter.charts.length > 0) {
    return filter.charts.includes(chart?.id);
  }

  if (filter?.fieldId || filter?.field) {
    if (chartContainsFilterTarget(chart, filter)) {
      return true;
    }

    return getChartFieldTargets(chart).length === 0;
  }

  return true;
}

function isBoundDateFilter(filter = {}) {
  return filter?.type === "date" && (
    Boolean(filter?.fieldId)
    || Boolean(filter?.field)
    || (
      Array.isArray(filter?.bindings)
      && filter.bindings.some((binding) => (
        binding?.targetType === "field" || binding?.targetType === "questionFilter"
      ))
    )
  );
}

function extractConditionVariables(condition = {}) {
  const variableNames = new Set();

  if (condition.variable) {
    variableNames.add(condition.variable);
  }

  if (condition.variableName) {
    variableNames.add(condition.variableName);
  }

  if (typeof condition.value === "string") {
    const matches = condition.value.match(/\{\{\s*([^}]+?)\s*\}\}/g) || [];
    matches.forEach((match) => {
      const variableName = match.replace(/\{\{|\}\}/g, "").trim();
      if (variableName) {
        variableNames.add(variableName);
      }
    });
  }

  return variableNames;
}

export function getProjectFilters(filtersByProject = {}, projectId) {
  if (!projectId || !filtersByProject || typeof filtersByProject !== "object") {
    return [];
  }

  return Array.isArray(filtersByProject[projectId]) ? filtersByProject[projectId] : [];
}

export function getDashboardVariables(filters = []) {
  return (filters || [])
    .filter((filter) => filter?.type === "variable" && filter.variable && hasVariableFilterValue(filter))
    .reduce((acc, filter) => {
      acc[filter.variable] = filter.value;
      return acc;
    }, {});
}

export function getChartIdentifiedConditions(chart = {}) {
  const identifiedConditions = [];
  const seenConditions = new Set();

  (chart.ChartDatasetConfigs || []).forEach((cdc) => {
    (cdc?.Dataset?.conditions || []).forEach((condition) => {
      const conditionKey = [
        condition?.id,
        condition?.filterId,
        condition?.bindingId,
        condition?.variable,
        condition?.variableName,
        condition?.field,
      ]
        .filter(Boolean)
        .join(":");

      if (!conditionKey || seenConditions.has(conditionKey)) {
        return;
      }

      seenConditions.add(conditionKey);
      identifiedConditions.push(condition);
    });
  });

  return identifiedConditions;
}

export function getClearedVariableFilters(currentFilters = [], previousFilters = []) {
  const previousFilterLookup = new Map(
    (previousFilters || [])
      .filter((filter) => filter?.type === "variable")
      .map((filter) => [getFilterKey(filter), filter])
      .filter(([key]) => Boolean(key))
  );

  return (currentFilters || []).filter((filter) => {
    if (filter?.type !== "variable" || hasVariableFilterValue(filter)) {
      return false;
    }

    const previousFilter = previousFilterLookup.get(getFilterKey(filter));
    return hasVariableFilterValue(previousFilter);
  });
}

export function getLegacyVariableConditions(variableFilters = [], identifiedConditions = []) {
  const legacyConditions = [];

  (variableFilters || []).forEach((filter) => {
    const filterVariable = filter?.variable;
    const filterId = filter?.id || null;

    (identifiedConditions || []).forEach((condition) => {
      const conditionVariables = extractConditionVariables(condition);
      const matchesVariable = filterVariable && conditionVariables.has(filterVariable);
      const matchesId = filterId && (
        condition?.id === filterId
        || condition?.filterId === filterId
        || condition?.bindingId === filterId
      );

      if (!matchesVariable && !matchesId) {
        return;
      }

      legacyConditions.push({
        ...condition,
        value: filter.value,
        filterId: condition?.filterId || filterId,
      });
    });
  });

  return legacyConditions;
}

export function getActiveDateFilters(currentFilters = [], previousFilters = []) {
  const previousFilterLookup = new Map(
    (previousFilters || [])
      .filter((filter) => filter?.type === "date")
      .map((filter) => [getFilterKey(filter), filter])
      .filter(([key]) => Boolean(key))
  );

  return (currentFilters || []).filter((filter) => {
    if (filter?.type !== "date") {
      return false;
    }

    if (isBoundDateFilter(filter)) {
      return false;
    }

    if (hasDateFilterValue(filter)) {
      return true;
    }

    const previousFilter = previousFilterLookup.get(getFilterKey(filter));
    return hasDateFilterValue(previousFilter);
  });
}

export function buildProcessedChartFilters({
  chart,
  currentFilters = [],
  previousFilters = [],
}) {
  const previousFilterLookup = new Map(
    (previousFilters || [])
      .map((filter) => [getFilterKey(filter), filter])
      .filter(([key]) => Boolean(key))
  );

  const fieldFilters = (currentFilters || [])
    .filter((filter) => {
      if (filter?.type !== "field" || !filterAppliesToChart(filter, chart)) {
        return false;
      }

      if (hasFieldFilterValue(filter)) {
        return true;
      }

      const previousFilter = previousFilterLookup.get(getFilterKey(filter));
      return hasFieldFilterValue(previousFilter);
    })
    .map((filter) => normalizeFilterForChart(filter, chart));

  const boundDateFilters = (currentFilters || [])
    .filter((filter) => {
      if (filter?.type !== "date" || !isBoundDateFilter(filter) || !filterAppliesToChart(filter, chart)) {
        return false;
      }

      if (hasDateFilterValue(filter)) {
        return true;
      }

      const previousFilter = previousFilterLookup.get(getFilterKey(filter));
      return hasDateFilterValue(previousFilter);
    })
    .map((filter) => normalizeFilterForChart(filter, chart));

  const identifiedConditions = getChartIdentifiedConditions(chart);
  const currentVariableFilters = (currentFilters || []).filter(
    (filter) => filter?.type === "variable" && hasVariableFilterValue(filter)
  );
  const clearedVariableFilters = getClearedVariableFilters(currentFilters, previousFilters);
  const legacyVariableConditions = getLegacyVariableConditions(
    [...currentVariableFilters, ...clearedVariableFilters],
    identifiedConditions
  );

  return {
    processedFilters: [...fieldFilters, ...boundDateFilters, ...legacyVariableConditions],
  };
}

export function getApplicableDashboardFiltersForChart(filters = [], chart = {}) {
  return (filters || [])
    .filter((filter) => filter?.type !== "variable")
    .filter((filter) => filterAppliesToChart(filter, chart))
    .map((filter) => normalizeFilterForChart(filter, chart));
}
