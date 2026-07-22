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
