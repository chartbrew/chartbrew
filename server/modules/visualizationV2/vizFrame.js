const _ = require("lodash");

const determineType = require("../determineType");
const { getScopedRuntimeFilters } = require("./filterPlan");
const {
  buildVisualizationVariableContext,
  extractVariableName,
  resolveVisualizationVariableValue,
} = require("./variableResolution");
const {
  compileSelector,
  getSelectorCollectionItems,
  getSelectorValue,
} = require("./selectors");
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

function shouldKeepConditionValue(condition = {}) {
  return condition.operator === "isNull"
    || condition.operator === "isNotNull"
    || condition.value === 0
    || condition.value === false
    || Boolean(condition.value);
}

function buildVariableConditions(datasetOptions = {}, variableContext = {}) {
  if (
    !Array.isArray(datasetOptions.conditions)
    || !variableContext?.values
    || Object.keys(variableContext.values).length === 0
  ) {
    return [];
  }

  const variableConditions = [];

  datasetOptions.conditions.forEach((condition) => {
    const variableName = extractVariableName(condition.value);

    if (variableName) {
      const variableValue = resolveVisualizationVariableValue(variableContext, variableName);
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
      const bindingValue = resolveVisualizationVariableValue(variableContext, binding.name);
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

function getComparableValue(value, type, timezone = "") {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (type === "date") {
    const momentValue = normalizeMomentValue(value, timezone);
    return momentValue?.isValid() ? momentValue : null;
  }

  if (type === "number") {
    if (typeof value === "number") {
      return value;
    }

    if (/^-?\d+(\.\d+)?$/.test(`${value}`)) {
      return Number(value);
    }
  }

  if (type === "boolean") {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
  }

  return value;
}

function compareConditionValue({
  fieldValue,
  condition = {},
  type,
  timezone = "",
  timeInterval = "day",
}) {
  if (condition.operator === "isNull") {
    return fieldValue === null || fieldValue === undefined || fieldValue === "";
  }

  if (condition.operator === "isNotNull") {
    return fieldValue !== null && fieldValue !== undefined && fieldValue !== "";
  }

  const conditionValue = getComparableValue(condition.value, type, timezone);
  const comparableFieldValue = getComparableValue(fieldValue, type, timezone);

  if (comparableFieldValue === null || comparableFieldValue === undefined) {
    return false;
  }

  if (type === "date") {
    if (!conditionValue || !comparableFieldValue?.isValid?.()) {
      return false;
    }

    const fieldMoment = comparableFieldValue.clone();
    const conditionMoment = conditionValue.clone ? conditionValue.clone() : conditionValue;
    const dayGranular = timeInterval === "day"
      || timeInterval === "week"
      || timeInterval === "month"
      || timeInterval === "year";

    switch (condition.operator) {
      case "is":
        return dayGranular
          ? fieldMoment.startOf("day").isSame(conditionMoment.startOf("day"))
          : fieldMoment.isSame(conditionMoment, timeInterval);
      case "isNot":
        return dayGranular
          ? !fieldMoment.startOf("day").isSame(conditionMoment.startOf("day"))
          : !fieldMoment.isSame(conditionMoment, timeInterval);
      case "greaterThan":
        return dayGranular
          ? fieldMoment.startOf("day").isAfter(conditionMoment.startOf("day"))
          : fieldMoment.isAfter(conditionMoment, timeInterval);
      case "greaterOrEqual":
        return dayGranular
          ? fieldMoment.startOf("day").isSameOrAfter(conditionMoment.startOf("day"))
          : fieldMoment.isSameOrAfter(conditionMoment, timeInterval);
      case "lessThan":
        return dayGranular
          ? fieldMoment.startOf("day").isBefore(conditionMoment.startOf("day"))
          : fieldMoment.isBefore(conditionMoment, timeInterval);
      case "lessOrEqual":
        return dayGranular
          ? fieldMoment.startOf("day").isSameOrBefore(conditionMoment.startOf("day"))
          : fieldMoment.isSameOrBefore(conditionMoment, timeInterval);
      default:
        return false;
    }
  }

  switch (condition.operator) {
    case "is":
      return comparableFieldValue === conditionValue;
    case "isNot":
      return comparableFieldValue !== conditionValue;
    case "contains":
      return `${comparableFieldValue}`.indexOf(conditionValue) > -1;
    case "notContains":
      return `${comparableFieldValue}`.indexOf(conditionValue) === -1;
    case "greaterThan":
      return comparableFieldValue > conditionValue;
    case "greaterOrEqual":
      return comparableFieldValue >= conditionValue;
    case "lessThan":
      return comparableFieldValue < conditionValue;
    case "lessOrEqual":
      return comparableFieldValue <= conditionValue;
    default:
      return false;
  }
}

function createCompiledCondition(condition = {}, datasetOptions = {}, collectionSelector) {
  const selector = compileSelector(condition.field, datasetOptions);
  if (!selector) {
    return null;
  }

  if ((selector.collectionPath || null) !== (collectionSelector.collectionPath || null)) {
    return null;
  }

  return {
    ...condition,
    selector,
  };
}

function buildConditionsOptions(items = [], conditions = []) {
  return conditions.map((condition) => {
    return {
      id: condition.id,
      field: condition.field,
      exposed: condition.exposed,
      source: condition.source || null,
      bindingId: condition.bindingId || null,
      filterId: condition.filterId || null,
      values: _.uniq(items.map((item) => getSelectorValue(item, condition.selector))),
    };
  });
}

function applyCompiledConditionSet(items = [], compiledConditions = [], chart = {}, timezone = "") {
  if (!Array.isArray(compiledConditions) || compiledConditions.length === 0) {
    return items;
  }

  return items.filter((item) => {
    return compiledConditions.every((condition) => {
      const sampleValue = getSelectorValue(item, condition.selector);
      const type = condition.selector.type || determineType(sampleValue);
      return compareConditionValue({
        fieldValue: sampleValue,
        condition,
        type,
        timezone,
        timeInterval: chart.timeInterval,
      });
    });
  });
}

function replaceCollectionItems(datasetData, collectionSelector, items) {
  if (collectionSelector.isRootArray) {
    return items;
  }

  if (!collectionSelector.collectionAccessorPath) {
    if (Array.isArray(datasetData)) {
      return items;
    }

    return items[0] || datasetData;
  }

  const nextData = _.cloneDeep(datasetData);
  _.set(nextData, collectionSelector.collectionAccessorPath, items);
  return nextData;
}

function buildImplicitDateConditions({
  chart,
  datasetOptions,
  scopedFilters = [],
  timezone = "",
}) {
  const { startDate, endDate } = getResolvedChartDateWindow(chart, timezone);
  const dateRangeFilter = scopedFilters.find((filter) => {
    return filter.type === "date" && filter.startDate && filter.endDate;
  });
  const fieldFilters = scopedFilters.filter((filter) => filter.field && filter.type !== "date");

  if (
    !datasetOptions.dateField
    || !((chart.startDate && chart.endDate) || dateRangeFilter)
    || fieldFilters.some((filter) => filter.field === datasetOptions.dateField)
  ) {
    return [];
  }

  return [{
    field: datasetOptions.dateField,
    value: dateRangeFilter ? dateRangeFilter.startDate : startDate,
    operator: "greaterOrEqual",
    source: "v2_runtime",
  }, {
    field: datasetOptions.dateField,
    value: dateRangeFilter ? dateRangeFilter.endDate : endDate,
    operator: "lessOrEqual",
    source: "v2_runtime",
  }];
}

function buildDatasetExecution({
  chart,
  dataset,
  runtimeFilters = [],
  variables = {},
  timezone = "",
}) {
  const datasetOptions = dataset.options || {};
  const collectionSelector = compileSelector(
    datasetOptions.xAxis || datasetOptions.dateField || "root[]",
    datasetOptions,
  );

  if (!collectionSelector) {
    throw new VizFrameCompatibilityError("Missing selector path for VizFrame execution.");
  }

  const collectionItems = getSelectorCollectionItems(dataset.data, collectionSelector);
  if (!Array.isArray(collectionItems)) {
    throw new VizFrameCompatibilityError("VizFrame requires array-backed dataset collections.");
  }

  let resolvedVariableContext = dataset.runtimeVariableContext;
  if (!resolvedVariableContext) {
    if (dataset.runtimeVariables) {
      resolvedVariableContext = {
        values: dataset.runtimeVariables,
      };
    } else {
      resolvedVariableContext = buildVisualizationVariableContext({
        variables,
        datasetOptions,
      });
    }
  }

  const reusableConditions = Array.isArray(datasetOptions.conditions)
    ? datasetOptions.conditions.filter((condition) => !containsMustache(condition?.value))
    : [];
  const activeReusableConditions = reusableConditions.filter((condition) => {
    return shouldKeepConditionValue(condition);
  });
  const variableConditions = buildVariableConditions(datasetOptions, resolvedVariableContext);
  const scopedFilters = getScopedRuntimeFilters(runtimeFilters, chart, datasetOptions);
  const runtimeConditions = [
    ...scopedFilters.filter((filter) => filter.field && filter.type !== "date"),
    ...buildImplicitDateConditions({
      chart,
      datasetOptions,
      scopedFilters,
      timezone,
    }),
    ...variableConditions,
  ];

  const compiledReusableConditions = reusableConditions
    .map((condition) => createCompiledCondition(condition, datasetOptions, collectionSelector))
    .filter(Boolean);
  const compiledActiveReusableConditions = activeReusableConditions
    .map((condition) => createCompiledCondition(condition, datasetOptions, collectionSelector))
    .filter(Boolean);
  const compiledRuntimeConditions = runtimeConditions
    .map((condition) => createCompiledCondition(condition, datasetOptions, collectionSelector))
    .filter(Boolean);
  const compiledAllConditions = [
    ...compiledActiveReusableConditions,
    ...compiledRuntimeConditions,
  ];

  const conditionsOptions = [];
  let metadataItems = collectionItems;
  compiledReusableConditions.forEach((condition) => {
    conditionsOptions.push(...buildConditionsOptions(metadataItems, [condition]));
    if (shouldKeepConditionValue(condition)) {
      metadataItems = applyCompiledConditionSet(metadataItems, [condition], chart, timezone);
    }
  });

  const filteredItems = applyCompiledConditionSet(
    collectionItems,
    compiledAllConditions,
    chart,
    timezone,
  );

  return {
    datasetId: datasetOptions.id,
    collectionSelector,
    collectionItems,
    filteredItems,
    filteredData: replaceCollectionItems(dataset.data, collectionSelector, filteredItems),
    reusableConditions,
    runtimeConditions,
    allConditions: compiledAllConditions,
    conditionsOptions: [{
      dataset_id: datasetOptions.id,
      conditions: conditionsOptions,
    }],
  };
}

function applyDatasetFilters({
  chart,
  dataset,
  runtimeFilters = [],
  variables = {},
  timezone = "",
}) {
  const execution = buildDatasetExecution({
    chart,
    dataset,
    runtimeFilters,
    variables,
    timezone,
  });

  return {
    filteredData: execution.filteredData,
    conditionsOptions: execution.conditionsOptions,
    filteredItems: execution.filteredItems,
    execution,
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
  datasetExecution,
  timezone = "",
}) {
  const datasetOptions = dataset.options || {};
  const xSelector = compileSelector(datasetOptions.xAxis, datasetOptions);
  const ySelector = compileSelector(datasetOptions.yAxis, datasetOptions);

  if (!xSelector || !ySelector) {
    throw new VizFrameCompatibilityError("VizFrame requires array-backed x/y selectors.");
  }

  if (
    (xSelector.collectionPath || null)
      !== (datasetExecution.collectionSelector.collectionPath || null)
    || (ySelector.collectionPath || null)
      !== (datasetExecution.collectionSelector.collectionPath || null)
  ) {
    throw new VizFrameCompatibilityError("VizFrame requires aligned dataset collections.");
  }

  if (!Array.isArray(datasetExecution.filteredItems)) {
    throw new VizFrameCompatibilityError("VizFrame requires array-backed x/y data.");
  }

  const xValues = datasetExecution.filteredItems.map((item) => getSelectorValue(item, xSelector));
  const yValues = datasetExecution.filteredItems.map((item) => getSelectorValue(item, ySelector));
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
  const datasetExecutions = datasets.map((dataset, index) => {
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

    return {
      cdcId: cdc.id,
      label: cdc.legend || dataset?.options?.legend,
      dataset,
      cdc,
      ...filteringResult.execution,
    };
  });

  const isTableMode = chart?.type === "table";
  const seriesFrames = isTableMode ? [] : datasetExecutions.map((datasetExecution) => {
    return buildSeriesFrame({
      chart,
      dataset: datasetExecution.dataset,
      cdc: datasetExecution.cdc,
      datasetExecution,
      timezone,
    });
  });

  const unifiedLabels = isTableMode
    ? { labels: [], isTimeseries: false, dateFormat: null }
    : buildUnifiedLabels(seriesFrames, chart, timezone);

  const series = isTableMode ? [] : seriesFrames.map((seriesFrame) => {
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
    datasetExecutions,
    conditionsOptions,
  };
}

module.exports = {
  VizFrameCompatibilityError,
  applyDatasetFilters,
  buildDatasetExecution,
  buildVizFrame,
};
