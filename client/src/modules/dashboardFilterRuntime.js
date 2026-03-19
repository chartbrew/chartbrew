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

  const fieldFilters = (currentFilters || []).filter((filter) => {
    if (filter?.type !== "field") {
      return false;
    }

    if (hasFieldFilterValue(filter)) {
      return true;
    }

    const previousFilter = previousFilterLookup.get(getFilterKey(filter));
    return hasFieldFilterValue(previousFilter);
  });

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
    processedFilters: [...fieldFilters, ...legacyVariableConditions],
  };
}
