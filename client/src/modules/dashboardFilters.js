export function mergeDashboardFilters(sharedFilters = [], localFilters = []) {
  const localFiltersById = new Map(localFilters.map((filter) => [filter.id, filter]));
  const sharedFilterIds = new Set(sharedFilters.map((filter) => filter.id));
  const mergedSharedFilters = sharedFilters.map((filter) => {
    const local = localFiltersById.get(filter.id);
    const shared = filter.configuration;
    const configuration = Array.isArray(shared.options)
      ? { ...shared, value: local?.field === shared.field ? local.value ?? shared.value : shared.value }
      : { ...shared, ...local };
    return { ...configuration, id: filter.id, onReport: filter.onReport };
  });
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

export function getFieldFilterChoices(filter) {
  const choices = [
    { id: "all", label: filter.allLabel || "All", value: "" },
    ...(filter.options || []).map((value, index) => ({ id: `option:${index}`, label: String(value), value })),
  ];
  if (filter.value !== undefined && filter.value !== null && filter.value !== ""
    && !choices.some((choice) => choice.value === filter.value)) {
    choices.push({ id: "current", label: String(filter.value), value: filter.value });
  }
  return choices;
}
