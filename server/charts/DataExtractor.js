const _ = require("lodash");

const { buildChartRuntimeContext, getDatasetDateConditions, getDatasetRuntimeFilters } = require("../modules/chartRuntimeFilters");
const dataFilter = require("./dataFilter");

module.exports = (data, filters, timezone) => {
  const { chart, datasets } = data;
  const runtimeContext = buildChartRuntimeContext(chart, filters, {}, timezone);

  // check if the global date filter should be on or off
  // the filter should work only if all the datasets have a dateField
  let canDateFilter = true;
  datasets.map((dataset) => {
    if (!dataset.options || !dataset.options.dateField) {
      canDateFilter = false;
    }
    return dataset;
  });

  // this is only used when exporting data
  const exportData = {};
  const conditionsOptions = [];

  for (let i = 0; i < datasets.length; i++) {
    const dataset = datasets[i];
    const { dateField } = dataset.options;
    let xAxis = dataset.options.xAxis || "root[]";
    let xData;

    const filterData = dataFilter(dataset.data, xAxis, dataset.options.conditions);
    if (filterData.conditionsOptions) {
      conditionsOptions.push({
        dataset_id: dataset.options.id,
        conditions: filterData.conditionsOptions,
      });
    }

    let filteredData = filterData.data;

    const runtimeFieldFilters = getDatasetRuntimeFilters(runtimeContext, dataset.options);
    const runtimeDateConditions = canDateFilter
      ? getDatasetDateConditions(runtimeContext, dataset.options)
      : [];

    if (runtimeDateConditions.length > 0 && dateField) {
      filteredData = dataFilter(filteredData, dateField, runtimeDateConditions, timezone, chart.timeInterval).data;
    }

    if (runtimeFieldFilters.length > 0 && dataset.options && dataset.options.fieldsSchema) {
      runtimeFieldFilters.forEach((filter) => {
        if (filter.field === dateField) return;
        filteredData = dataFilter(filteredData, filter.field, [filter], timezone, chart.timeInterval).data;
      });
    }

    // get the data corresponding to the xAxis
    if (xAxis.indexOf("root[]") > -1) {
      xAxis = xAxis.replace("root[].", "");
      // and data stays the same
      xData = filteredData;
    } else {
      const arrayFinder = xAxis.substring(0, xAxis.indexOf("]") - 1).replace("root.", "");
      xAxis = xAxis.substring(xAxis.indexOf("]") + 2);

      xData = _.get(filteredData, arrayFinder);
    }
    if (!Array.isArray(xData)) {
      xData = [];
    }

    // transform the object in case there are any groupings
    // also exclude any fields that are marked to be excluded
    const pairedXData = [];

    xData.forEach((item) => {
      const newItem = item;
      if (dataset.options.groups && dataset.options.groups.length > 0) {
        dataset.options.groups.forEach((group) => {
          // extract the data using the groups schema
          let newKey = _.get(newItem, group.key);
          const newValue = _.get(newItem, group.value);
          if (newKey && newValue && typeof newKey.replaceAll === "function") {
            // make sure the new keys don't have dots "." in them
            // the dots prevent the values from rendering properly
            newKey = newKey.replaceAll(".", " ");
            newItem[`${newKey}`] = newValue;
          }
        });
      }

      pairedXData.push(newItem);
    });

    const groupedXData = [];
    let { groupBy } = dataset.options;
    if (groupBy) {
      groupBy = groupBy.replace("root[].", "");
      // Apply groupBy on the data
      pairedXData.forEach((item) => {
        const foundIndex = _.findIndex(groupedXData, { [groupBy]: item[groupBy] });
        if (foundIndex > -1) {
          groupedXData[foundIndex] = { ...groupedXData[foundIndex], ...item };
        } else {
          groupedXData.push(item);
        }
      });
    } else {
      groupedXData.push(...pairedXData);
    }

    exportData[dataset.options.legend] = groupedXData;
  }

  return {
    configuration: exportData,
    conditionsOptions,
  };
};
