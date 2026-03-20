function matchesScope(target = {}, context = {}) {
  const chartId = context.chart?.id;
  const cdcId = context.cdc?.id;
  const datasetId = context.datasetOptions?.id;

  if (Array.isArray(target.charts) && target.charts.length > 0) {
    return target.charts.some((id) => `${id}` === `${chartId}`);
  }

  if (target.chartId && `${target.chartId}` !== `${chartId}`) {
    return false;
  }

  if (target.cdcId && `${target.cdcId}` !== `${cdcId}`) {
    return false;
  }

  if (target.datasetId && `${target.datasetId}` !== `${datasetId}`) {
    return false;
  }

  return true;
}

module.exports = {
  matchesScope,
};
