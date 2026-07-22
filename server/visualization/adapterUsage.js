const usage = {
  charts: new Map(),
  total: 0,
};

function recordAdapterUsage(chart) {
  const chartId = chart?.id === undefined || chart?.id === null ? "unknown" : `${chart.id}`;
  usage.total += 1;
  usage.charts.set(chartId, (usage.charts.get(chartId) || 0) + 1);
}

function getAdapterUsage() {
  return {
    chartCount: usage.charts.size,
    charts: [...usage.charts.entries()]
      .map(([chartId, count]) => ({ chartId, count }))
      .sort((left, right) => right.count - left.count),
    total: usage.total,
  };
}

function resetAdapterUsage() {
  usage.charts.clear();
  usage.total = 0;
}

module.exports = {
  getAdapterUsage,
  recordAdapterUsage,
  resetAdapterUsage,
};
