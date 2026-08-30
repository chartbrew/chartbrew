const counters = new Map();

function metricKey(name, labels = {}) {
  const normalizedLabels = Object.keys(labels).sort().reduce((result, key) => {
    result[key] = labels[key];
    return result;
  }, {});
  return `${name}:${JSON.stringify(normalizedLabels)}`;
}

function incrementDataApiMetric(name, labels = {}, amount = 1) {
  const key = metricKey(name, labels);
  counters.set(key, (counters.get(key) || 0) + amount);
}

function getDataApiMetrics() {
  return Object.fromEntries(counters.entries());
}

function resetDataApiMetrics() {
  counters.clear();
}

module.exports = {
  getDataApiMetrics,
  incrementDataApiMetric,
  resetDataApiMetrics,
};
