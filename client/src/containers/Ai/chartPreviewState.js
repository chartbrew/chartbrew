function getChartPreviewKey(preview = {}) {
  if (!preview.chartId || !preview.projectId) return null;
  return `${preview.projectId}:${preview.chartId}`;
}

function shouldLoadChartPreview(fetchedKeys, preview, retry = false) {
  const key = getChartPreviewKey(preview);
  if (!key) return false;
  return retry || !fetchedKeys.has(key);
}

function setChartPreviewLoading(state, key) {
  return {
    ...state,
    [key]: { chart: state[key]?.chart || null, error: false },
  };
}

function setChartPreviewLoaded(state, key, chart) {
  return { ...state, [key]: { chart, error: false } };
}

function setChartPreviewFailed(state, key) {
  return { ...state, [key]: { chart: null, error: true } };
}

export {
  getChartPreviewKey,
  setChartPreviewFailed,
  setChartPreviewLoaded,
  setChartPreviewLoading,
  shouldLoadChartPreview,
};
