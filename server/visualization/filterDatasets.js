const {
  buildChartRuntimeContext,
  getDatasetDateConditions,
  getDatasetRuntimeFilters,
} = require("../modules/chartRuntimeFilters");
const _ = require("lodash");
const dataFilter = require("../charts/dataFilter");
const { resolveDatasetDateField } = require("./dateField");

function getBindingId(dataset) {
  return dataset?.options?.cdc_id ?? dataset?.options?.id ?? dataset?.bindingId ?? null;
}

function getBindingSelector(visualization, dataset) {
  const bindingId = getBindingId(dataset);
  const layer = visualization.layers.find((item) => `${item.bindingId}` === `${bindingId}`);
  const encodingField = layer
    ? Object.values(layer.encoding).flat().find((encoding) => encoding?.field)?.field
    : null;

  return encodingField
    || dataset?.options?.xAxis
    || dataset?.options?.dateField
    || dataset?.options?.yAxis
    || "root[]";
}

function getVariableConditions(options, variables = {}) {
  if (!Array.isArray(options?.conditions) || Object.keys(variables).length === 0) return [];
  const variableConditions = [];

  options.conditions.forEach((condition) => {
    const mustacheMatch = condition.value?.toString().match(/\{\{(\w+)\}\}/);
    if (mustacheMatch) {
      const value = variables[mustacheMatch[1]];
      if (value !== null && value !== undefined && value !== "") {
        variableConditions.push({
          field: condition.field,
          operator: condition.operator || "is",
          value,
        });
      }
    }
  });

  (options.VariableBindings || []).forEach((binding) => {
    const value = variables[binding.name];
    if (value === null || value === undefined || value === "") return;

    options.conditions.forEach((condition) => {
      if (!condition.field || condition.value?.toString().includes("{{")) return;
      const referencesVariable = condition.field.includes(binding.name)
        || condition.field === binding.name
        || condition.variableName === binding.name;
      if (referencesVariable) {
        variableConditions.push({
          field: condition.field,
          operator: condition.operator || "is",
          value,
        });
      }
    });
  });

  return variableConditions;
}

function applyConditions(data, selector, conditions, timezone, timeInterval) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return { data, conditionsOptions: null };
  }

  return dataFilter(data, selector, conditions, timezone, timeInterval);
}

function filterVisualizationDatasets({
  chart,
  datasets,
  filters = [],
  timezone,
  variables = {},
  visualization,
}) {
  const runtimeContext = buildChartRuntimeContext(chart, filters, variables, timezone);
  const dateFields = datasets.map((dataset) => resolveDatasetDateField(visualization, dataset));
  const canDateFilter = dateFields.every(Boolean);
  const conditionsOptions = [];
  const filteredDatasets = datasets.map((dataset, datasetIndex) => {
    const options = dataset.options || {};
    const dateField = dateFields[datasetIndex];
    const resolvedOptions = dateField && !options.dateField
      ? { ...options, dateField }
      : options;
    const selector = getBindingSelector(visualization, dataset);
    const savedConditions = Array.isArray(options.conditions)
      ? options.conditions.filter((condition) => !condition.value?.toString().includes("{{"))
      : [];
    const savedResult = applyConditions(
      dataset.data,
      selector,
      savedConditions,
      timezone,
      chart.timeInterval
    );

    if (savedResult.conditionsOptions) {
      conditionsOptions.push({
        conditions: savedResult.conditionsOptions,
        dataset_id: options.id,
      });
    }

    let data = savedResult.data;
    const runtimeDateConditions = canDateFilter
      ? getDatasetDateConditions(runtimeContext, resolvedOptions)
      : [];
    if (runtimeDateConditions.length > 0 && dateField) {
      data = dataFilter(
        data,
        dateField,
        runtimeDateConditions,
        timezone,
        chart.timeInterval
      ).data;
    }

    const runtimeFilters = getDatasetRuntimeFilters(runtimeContext, resolvedOptions);
    if (runtimeFilters.length > 0 && resolvedOptions.fieldsSchema) {
      runtimeFilters.forEach((filter) => {
        if (filter.field === dateField) return;
        data = dataFilter(data, filter.field, [filter], timezone, chart.timeInterval).data;
      });
    }

    getVariableConditions(resolvedOptions, variables).forEach((condition) => {
      data = dataFilter(
        data,
        condition.field,
        [condition],
        timezone,
        chart.timeInterval
      ).data;
    });

    return {
      ...dataset,
      data,
      options: resolvedOptions,
    };
  });

  return {
    conditionsOptions,
    datasets: filteredDatasets,
    runtimeContext,
  };
}

function filterDatasetResult(data, filters = [], timezone = "UTC") {
  return filters.reduce((filteredData, filter) => {
    const arrayMarker = filter.field.indexOf("[]");
    if (arrayMarker < 0) return filteredData;

    const collectionPath = filter.field.slice(0, arrayMarker).replace(/^root\.?/, "");
    const rowField = filter.field.slice(arrayMarker + 3);
    const collection = collectionPath ? _.get(filteredData, collectionPath) : filteredData;
    if (!Array.isArray(collection) || !rowField) return filteredData;

    let nextCollection;
    if (filter.operator === "isNull") {
      nextCollection = collection.filter((row) => {
        const value = _.get(row, rowField);
        return value === null || value === undefined;
      });
    } else if (filter.operator === "isNotNull") {
      nextCollection = collection.filter((row) => {
        const value = _.get(row, rowField);
        return value !== null && value !== undefined;
      });
    } else {
      nextCollection = dataFilter(
        collection,
        `root[].${rowField}`,
        [{ ...filter, field: `root[].${rowField}` }],
        timezone
      ).data;
    }

    if (!collectionPath) return nextCollection;
    const nextData = _.cloneDeep(filteredData);
    _.set(nextData, collectionPath, nextCollection);
    return nextData;
  }, data);
}

module.exports = {
  filterDatasetResult,
  filterVisualizationDatasets,
  getBindingSelector,
  getVariableConditions,
};
