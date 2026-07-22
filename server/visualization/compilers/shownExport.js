function getUniqueLabel(label, usedLabels) {
  const base = label || "Value";
  let candidate = base;
  let suffix = 2;
  while (usedLabels.has(candidate)) {
    candidate = `${base} ${suffix}`;
    suffix += 1;
  }
  usedLabels.add(candidate);
  return candidate;
}

function compileShownExport(configuration, chart = {}) {
  if (!configuration?.data?.labels || !configuration?.data?.datasets) {
    return configuration;
  }

  const usedLabels = new Set();
  const datasetLabels = configuration.data.datasets.map((dataset) => {
    return getUniqueLabel(dataset.label, usedLabels);
  });
  const rows = configuration.data.labels.map((label, index) => {
    return configuration.data.datasets.reduce((row, dataset, datasetIndex) => {
      row[datasetLabels[datasetIndex]] = dataset.data?.[index] ?? null;
      return row;
    }, { Category: label });
  });

  return {
    [chart.name || "Chart as shown"]: rows,
  };
}

module.exports = { compileShownExport };
