export function getCdcConditions(cdc) {
  if (Array.isArray(cdc?.conditions)) {
    return cdc.conditions;
  }

  if (Array.isArray(cdc?.Dataset?.conditions)) {
    return cdc.Dataset.conditions;
  }

  return [];
}

export function getChartIdentifiedConditions(chart) {
  const conditions = [];

  chart?.ChartDatasetConfigs?.forEach((cdc) => {
    conditions.push(...getCdcConditions(cdc));
  });

  return conditions;
}

export function getExposedChartFilters(chart) {
  const filters = [];

  chart?.ChartDatasetConfigs?.forEach((cdc) => {
    const conditions = getCdcConditions(cdc);

    conditions.forEach((condition) => {
      if (!condition.exposed) return;

      filters.push({
        ...condition,
        Dataset: cdc.Dataset,
        cdcId: cdc.id,
        sourceConditions: conditions,
      });
    });
  });

  return filters;
}
