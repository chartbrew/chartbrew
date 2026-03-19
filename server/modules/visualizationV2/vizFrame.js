const _ = require("lodash");

const dataFilter = require("../../charts/dataFilter");
const determineType = require("../determineType");
const { getScopedRuntimeFilters } = require("./filterPlan");
const {
  createFilledDateBuckets,
  formatDateBucket,
  getBucketStart,
  getDateLabelFormat,
  getResolvedChartDateWindow,
  normalizeMomentValue,
} = require("./dateHelpers");

class VizFrameCompatibilityError extends Error {
  constructor(message) {
    super(message);
    this.name = "VizFrameCompatibilityError";
  }
}

function containsMustache(value) {
  return typeof value === "string" && value.includes("{{");
}

function extractVariableName(value) {
  const match = typeof value === "string" ? value.match(/\{\{(\w+)\}\}/) : null;
  return match?.[1] || null;
}

function getVariableValue(variables = {}, variableName) {
  if (!variableName) {
    return undefined;
  }

  const value = variables[variableName];
  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
    return value.value;
  }

  return value;
}

function parseSelectorPath(selectorPath = "") {
  if (!selectorPath) {
    throw new VizFrameCompatibilityError("Missing selector path for VizFrame execution.");
  }

  if (selectorPath.indexOf("root[]") > -1) {
    return {
      collectionPath: null,
      fieldPath: selectorPath.replace("root[].", ""),
      rawPath: selectorPath,
    };
  }

  if (!selectorPath.includes("[]")) {
    return {
      collectionPath: null,
      fieldPath: selectorPath.replace(/^root\./, ""),
      rawPath: selectorPath,
    };
  }

  return {
    collectionPath: selectorPath.substring(0, selectorPath.indexOf("]") - 1).replace("root.", ""),
    fieldPath: selectorPath.substring(selectorPath.indexOf("]") + 2),
    rawPath: selectorPath,
  };
}

function getCollectionAndField(datasetData, selectorPath) {
  const parsedPath = parseSelectorPath(selectorPath);

  if (!parsedPath.collectionPath) {
    return {
      items: Array.isArray(datasetData) ? datasetData : null,
      fieldPath: parsedPath.fieldPath,
      parsedPath,
    };
  }

  return {
    items: _.get(datasetData, parsedPath.collectionPath),
    fieldPath: parsedPath.fieldPath,
    parsedPath,
  };
}

function buildVariableConditions(datasetOptions = {}, variables = {}) {
  if (
    !Array.isArray(datasetOptions.conditions)
    || !variables
    || Object.keys(variables).length === 0
  ) {
    return [];
  }

  const variableConditions = [];

  datasetOptions.conditions.forEach((condition) => {
    const variableName = extractVariableName(condition.value);

    if (variableName) {
      const variableValue = getVariableValue(variables, variableName);
      if (variableValue !== null && variableValue !== undefined && variableValue !== "") {
        variableConditions.push({
          ...condition,
          value: variableValue,
        });
      }
    }
  });

  if (Array.isArray(datasetOptions.VariableBindings)) {
    datasetOptions.VariableBindings.forEach((binding) => {
      const bindingValue = getVariableValue(variables, binding.name);
      if (bindingValue === null || bindingValue === undefined || bindingValue === "") {
        return;
      }

      datasetOptions.conditions.forEach((condition) => {
        if (!condition.field || containsMustache(condition.value)) {
          return;
        }

        const fieldReferencesVariable = condition.field.includes(binding.name)
          || condition.field === binding.name
          || condition.variableName === binding.name;

        if (fieldReferencesVariable) {
          variableConditions.push({
            ...condition,
            value: bindingValue,
          });
        }
      });
    });
  }

  return variableConditions;
}

function applyDatasetFilters({
  chart,
  dataset,
  runtimeFilters = [],
  variables = {},
  timezone = "",
}) {
  const datasetOptions = dataset.options || {};
  const resolvedVariables = dataset.runtimeVariables || variables;
  const { xAxis } = datasetOptions;
  const { startDate, endDate } = getResolvedChartDateWindow(chart, timezone);
  const conditionsOptions = [];

  let filteredData = dataset.data;

  const baseConditions = Array.isArray(datasetOptions.conditions)
    ? datasetOptions.conditions.filter((condition) => !containsMustache(condition.value))
    : [];

  if (baseConditions.length > 0) {
    const filteredResult = dataFilter(
      filteredData,
      xAxis,
      baseConditions,
      timezone,
      chart.timeInterval,
    );
    filteredData = filteredResult.data;

    if (filteredResult.conditionsOptions) {
      conditionsOptions.push({
        dataset_id: datasetOptions.id,
        conditions: filteredResult.conditionsOptions,
      });
    }
  }

  const scopedFilters = getScopedRuntimeFilters(runtimeFilters, chart, datasetOptions);
  const dateRangeFilter = scopedFilters.find((filter) => {
    return filter.type === "date" && filter.startDate && filter.endDate;
  });
  const fieldFilters = scopedFilters.filter((filter) => filter.field && filter.type !== "date");

  if (
    datasetOptions.dateField
    && ((chart.startDate && chart.endDate) || dateRangeFilter)
    && !fieldFilters.some((filter) => filter.field === datasetOptions.dateField)
  ) {
    const dateConditions = [{
      field: datasetOptions.dateField,
      value: dateRangeFilter ? dateRangeFilter.startDate : startDate,
      operator: "greaterOrEqual",
    }, {
      field: datasetOptions.dateField,
      value: dateRangeFilter ? dateRangeFilter.endDate : endDate,
      operator: "lessOrEqual",
    }];

    filteredData = dataFilter(
      filteredData,
      datasetOptions.dateField,
      dateConditions,
      timezone,
      chart.timeInterval,
    ).data;
  }

  const fieldConditionsByField = new Map();
  fieldFilters.forEach((filter) => {
    if (!fieldConditionsByField.has(filter.field)) {
      fieldConditionsByField.set(filter.field, []);
    }

    fieldConditionsByField.get(filter.field).push(filter);
  });

  fieldConditionsByField.forEach((conditions, field) => {
    filteredData = dataFilter(
      filteredData,
      field,
      conditions,
      timezone,
      chart.timeInterval,
    ).data;
  });

  const variableConditions = buildVariableConditions(datasetOptions, resolvedVariables);
  variableConditions.forEach((condition) => {
    filteredData = dataFilter(
      filteredData,
      condition.field,
      [condition],
      timezone,
      chart.timeInterval,
    ).data;
  });

  return {
    filteredData,
    conditionsOptions,
  };
}

function getSampleType(values = [], fallbackType = null, aggregation = "none") {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value !== null && value !== undefined && value !== "") {
      return determineType(value, aggregation);
    }
  }

  return fallbackType;
}

function aggregateValues(values = [], aggregation = "none") {
  switch (aggregation) {
    case "count":
      return values.length;
    case "count_unique":
      return new Set(values.map((value) => JSON.stringify(value))).size;
    case "sum":
      return values.reduce((sum, value) => {
        const numericValue = Number(value);
        return sum + (Number.isNaN(numericValue) ? 0 : numericValue);
      }, 0);
    case "avg": {
      const total = values.reduce((sum, value) => {
        const numericValue = Number(value);
        return sum + (Number.isNaN(numericValue) ? 0 : numericValue);
      }, 0);
      return values.length > 0 ? Number((total / values.length).toFixed(2)) : 0;
    }
    case "min":
      return Math.min(...values.map((value) => Number(value)));
    case "max":
      return Math.max(...values.map((value) => Number(value)));
    case "none":
    default:
      return values[values.length - 1];
  }
}

function createDimensionKey({
  value,
  type,
  chart,
  timezone,
  explicitDateFormat = null,
}) {
  if (type === "date") {
    const nextMoment = normalizeMomentValue(value, timezone);
    if (!nextMoment || !nextMoment.isValid()) {
      return null;
    }

    const bucketMoment = getBucketStart(nextMoment, chart.timeInterval);
    const formattedBucket = formatDateBucket(
      bucketMoment,
      chart.timeInterval,
      explicitDateFormat || getDateLabelFormat(chart.timeInterval),
    );

    return {
      key: bucketMoment.valueOf().toString(),
      label: formattedBucket.label,
      sortValue: bucketMoment.valueOf(),
      bucketMoment,
    };
  }

  return {
    key: `${value}`,
    label: `${value}`,
    sortValue: null,
    bucketMoment: null,
  };
}

function buildSeriesFrame({
  chart,
  dataset,
  cdc,
  filteredData,
  timezone = "",
}) {
  const datasetOptions = dataset.options || {};
  const xDescriptor = getCollectionAndField(filteredData, datasetOptions.xAxis);
  const yDescriptor = getCollectionAndField(filteredData, datasetOptions.yAxis);

  if (!xDescriptor.items || !yDescriptor.items) {
    throw new VizFrameCompatibilityError("VizFrame requires array-backed x/y selectors.");
  }

  if (!Array.isArray(xDescriptor.items) || !Array.isArray(yDescriptor.items)) {
    throw new VizFrameCompatibilityError("VizFrame requires array-backed x/y data.");
  }

  if (
    xDescriptor.items !== yDescriptor.items
    && xDescriptor.items.length !== yDescriptor.items.length
  ) {
    throw new VizFrameCompatibilityError("VizFrame requires aligned dataset collections.");
  }

  const xValues = xDescriptor.items.map((item) => _.get(item, xDescriptor.fieldPath));
  const yValues = yDescriptor.items.map((item) => _.get(item, yDescriptor.fieldPath));
  const xType = getSampleType(xValues, datasetOptions.fieldsSchema?.[datasetOptions.xAxis]);
  const yType = getSampleType(
    yValues,
    datasetOptions.fieldsSchema?.[datasetOptions.yAxis],
    datasetOptions.yAxisOperation,
  );

  if (!xType) {
    throw new VizFrameCompatibilityError("Could not infer VizFrame dimension type.");
  }

  if (!yType && datasetOptions.yAxisOperation !== "count") {
    throw new VizFrameCompatibilityError("Could not infer VizFrame metric type.");
  }

  if (yType === "array" || yType === "object") {
    throw new VizFrameCompatibilityError("VizFrame scalar aggregation does not support array/object metrics yet.");
  }

  const groups = new Map();

  xValues.forEach((xValue, index) => {
    const yValue = yValues[index];

    if (xValue === null || xValue === undefined || xValue === "") {
      return;
    }

    const dimensionKey = createDimensionKey({
      value: xValue,
      type: xType,
      chart,
      timezone,
      explicitDateFormat: datasetOptions.dateFormat,
    });

    if (!dimensionKey) {
      return;
    }

    if (!groups.has(dimensionKey.key)) {
      groups.set(dimensionKey.key, {
        ...dimensionKey,
        values: [],
      });
    }

    groups.get(dimensionKey.key).values.push(yValue);
  });

  const aggregatedValues = new Map();
  groups.forEach((group, key) => {
    aggregatedValues.set(key, aggregateValues(group.values, datasetOptions.yAxisOperation));
  });

  const dataMode = cdc?.vizConfig?.options?.visualization?.dataMode || "series";

  return {
    cdcId: cdc.id,
    label: cdc.legend || datasetOptions.legend,
    xType,
    yType,
    dataMode,
    order: cdc.order || 1,
    groups,
    aggregatedValues,
  };
}

function buildUnifiedLabels(seriesFrames = [], chart = {}, timezone = "") {
  const isTimeseries = seriesFrames.some((frame) => frame.xType === "date");

  if (isTimeseries) {
    const observedBuckets = [];
    seriesFrames.forEach((frame) => {
      frame.groups.forEach((group) => {
        if (group.bucketMoment) {
          observedBuckets.push(group.bucketMoment.clone());
        }
      });
    });

    const filledBuckets = createFilledDateBuckets({
      observedBuckets,
      chart,
      includeZeros: chart.includeZeros !== false,
      timezone,
    });

    const labels = filledBuckets.map((bucketMoment) => {
      const formattedBucket = formatDateBucket(bucketMoment, chart.timeInterval);

      return {
        key: bucketMoment.valueOf().toString(),
        label: formattedBucket.label,
        sortValue: bucketMoment.valueOf(),
      };
    });

    return {
      labels,
      isTimeseries: true,
      dateFormat: getDateLabelFormat(chart.timeInterval),
    };
  }

  const labelMap = new Map();
  seriesFrames.forEach((frame) => {
    frame.groups.forEach((group, key) => {
      if (!labelMap.has(key)) {
        labelMap.set(key, {
          key,
          label: group.label,
          sortValue: null,
        });
      }
    });
  });

  return {
    labels: Array.from(labelMap.values()),
    isTimeseries: false,
    dateFormat: null,
  };
}

function applyPostOperations(seriesFrame = {}, chart = {}) {
  let values = seriesFrame.data;

  if (chart?.subType?.indexOf("AddTimeseries") > -1) {
    const cumulativeValues = [];
    values.forEach((value, index) => {
      const numericValue = Number(value) || 0;
      if (index === 0) {
        cumulativeValues.push(numericValue);
      } else {
        cumulativeValues.push(cumulativeValues[index - 1] + numericValue);
      }
    });
    values = cumulativeValues;
  }

  if (seriesFrame.dataMode === "seriesAverage") {
    const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);
    const average = values.length > 0 ? Number((total / values.length).toFixed(2)) : 0;
    values = [average];
  }

  return values;
}

function buildVizFrame({
  chart,
  datasets,
  filters = [],
  variables = {},
  timezone = "",
}) {
  const conditionsOptions = [];

  const seriesFrames = datasets.map((dataset, index) => {
    const cdc = chart.ChartDatasetConfigs[index];
    const filteringResult = applyDatasetFilters({
      chart,
      dataset,
      runtimeFilters: filters,
      variables,
      timezone,
    });

    filteringResult.conditionsOptions.forEach((conditionsOption) => {
      conditionsOptions.push(conditionsOption);
    });

    return buildSeriesFrame({
      chart,
      dataset,
      cdc,
      filteredData: filteringResult.filteredData,
      timezone,
    });
  });

  const unifiedLabels = buildUnifiedLabels(seriesFrames, chart, timezone);

  const series = seriesFrames.map((seriesFrame) => {
    const data = unifiedLabels.labels.map((label) => {
      if (seriesFrame.aggregatedValues.has(label.key)) {
        return seriesFrame.aggregatedValues.get(label.key);
      }

      return 0;
    });

    return {
      cdcId: seriesFrame.cdcId,
      label: seriesFrame.label,
      dataMode: seriesFrame.dataMode,
      data: applyPostOperations({
        ...seriesFrame,
        data,
      }, chart),
    };
  });

  return {
    labels: unifiedLabels.labels,
    isTimeseries: unifiedLabels.isTimeseries,
    dateFormat: unifiedLabels.dateFormat,
    series,
    conditionsOptions,
  };
}

module.exports = {
  VizFrameCompatibilityError,
  applyDatasetFilters,
  buildVizFrame,
};
