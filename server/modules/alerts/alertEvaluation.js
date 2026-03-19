function getAlertDataItems({
  chartData,
  datasetIndex,
  isTimeseries = false,
  alert = {},
}) {
  const dataset = chartData?.data?.datasets?.[datasetIndex];
  if (!dataset || !Array.isArray(dataset.data)) {
    return [];
  }

  if (
    isTimeseries
    && (!Array.isArray(alert.events) || alert.events.length === 0)
    && alert.type !== "anomaly"
  ) {
    return dataset.data.length > 0 ? [dataset.data[dataset.data.length - 1]] : [];
  }

  return dataset.data;
}

function matchesThreshold({
  value,
  alert,
}) {
  const { rules = {}, type } = alert;
  const { value: threshold, lower, upper } = rules;

  switch (type) {
    case "milestone":
      return value >= threshold;
    case "threshold_above":
      return value > threshold;
    case "threshold_below":
      return value < threshold;
    case "threshold_between":
      return value > lower && value < upper;
    case "threshold_outside":
      return value < lower || value > upper;
    default:
      return false;
  }
}

function findAlertTriggers({
  chartData,
  datasetIndex,
  alert,
  isTimeseries = false,
}) {
  const labels = chartData?.data?.labels;
  if (!Array.isArray(labels) || !alert?.type) {
    return [];
  }

  const dataItems = getAlertDataItems({
    chartData,
    datasetIndex,
    isTimeseries,
    alert,
  });

  if (dataItems.length === 0) {
    return [];
  }

  const alertsFound = [];
  dataItems.forEach((dataPoint, index) => {
    if (!matchesThreshold({ value: dataPoint, alert })) {
      return;
    }

    const labelIndex = dataItems.length === 1 ? labels.length - 1 : index;
    alertsFound.push({
      label: labels[labelIndex],
      value: dataPoint,
    });
  });

  return alertsFound;
}

module.exports = {
  findAlertTriggers,
  getAlertDataItems,
};
