export function buildSearchString(entries = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(entries).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    searchParams.set(key, `${value}`);
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function buildChartBuilderUrl(chartId = null, options = {}) {
  const search = buildSearchString({
    project_id: options.projectId || "",
    dataset_id: options.datasetId || "",
  });

  if (chartId) {
    return `/charts/${chartId}/edit${search}`;
  }

  return `/charts/new${search}`;
}

export function buildDatasetEditorUrl(datasetId, options = {}) {
  return `/datasets/${datasetId}${buildSearchString({
    chartFlow: options.chartFlow || "",
    chart_id: options.chartId || "",
    project_id: options.projectId || "",
    destination_project_id: options.destinationProjectId || "",
    return_to: options.returnTo || "",
  })}`;
}
