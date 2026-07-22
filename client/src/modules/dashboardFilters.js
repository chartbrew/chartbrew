export function mergeDashboardFilters(sharedFilters = [], localFilters = []) {
  const localFiltersById = new Map(localFilters.map((filter) => [filter.id, filter]));
  const sharedFilterIds = new Set(sharedFilters.map((filter) => filter.id));
  const mergedSharedFilters = sharedFilters.map((filter) => ({
    ...filter.configuration,
    ...localFiltersById.get(filter.id),
    id: filter.id,
    onReport: filter.onReport,
  }));
  const personalFilters = localFilters.filter((filter) => (
    !sharedFilterIds.has(filter.id) && filter.onReport === undefined
  ));

  return [...mergedSharedFilters, ...personalFilters];
}

export function resolveDateFilterChartSelection(eligibleChartIds = [], configuredChartIds = []) {
  if (!Array.isArray(configuredChartIds) || configuredChartIds.length === 0) {
    return [...eligibleChartIds];
  }

  const eligibleIds = new Set(eligibleChartIds);
  return configuredChartIds.filter((chartId) => eligibleIds.has(chartId));
}

export function serializeDateFilterChartSelection(eligibleChartIds = [], selectedChartIds = []) {
  const selectedIds = new Set(selectedChartIds);
  const hasAllCharts = eligibleChartIds.length === selectedChartIds.length
    && eligibleChartIds.every((chartId) => selectedIds.has(chartId));

  return hasAllCharts ? [] : selectedChartIds;
}
