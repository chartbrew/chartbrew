const _ = require("lodash");

const { applyDatasetFilters } = require("./vizFrame");

function getCollectionItems(filteredData, xAxis = "") {
  if (!xAxis) {
    if (Array.isArray(filteredData)) {
      return filteredData;
    }

    if (filteredData && typeof filteredData === "object") {
      return [filteredData];
    }

    return [];
  }

  if (xAxis.indexOf("root[]") > -1) {
    return Array.isArray(filteredData) ? filteredData : [];
  }

  if (xAxis.includes("[]")) {
    const collectionPath = xAxis.substring(0, xAxis.indexOf("]") - 1).replace("root.", "");
    const items = _.get(filteredData, collectionPath);
    return Array.isArray(items) ? items : [];
  }

  if (Array.isArray(filteredData)) {
    return filteredData;
  }

  if (filteredData && typeof filteredData === "object") {
    return [filteredData];
  }

  return [];
}

function applyGroupMappings(items = [], datasetOptions = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const groups = Array.isArray(datasetOptions.groups) ? datasetOptions.groups : [];
  if (groups.length === 0) {
    return items.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return { ...item };
      }

      return item;
    });
  }

  return items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return item;
    }

    const nextItem = { ...item };

    groups.forEach((group) => {
      let groupKey = _.get(nextItem, group.key);
      const groupValue = _.get(nextItem, group.value);

      if (groupKey && groupValue && typeof groupKey.replaceAll === "function") {
        groupKey = groupKey.replaceAll(".", " ");
        nextItem[`${groupKey}`] = groupValue;
      }
    });

    return nextItem;
  });
}

function applyGroupBy(items = [], groupBy) {
  if (!groupBy || !Array.isArray(items) || items.length === 0) {
    return items;
  }

  const normalizedGroupBy = groupBy.replace("root[].", "");
  const groupedItems = [];

  items.forEach((item) => {
    const foundIndex = _.findIndex(groupedItems, {
      [normalizedGroupBy]: item?.[normalizedGroupBy],
    });
    if (foundIndex > -1) {
      groupedItems[foundIndex] = { ...groupedItems[foundIndex], ...item };
    } else {
      groupedItems.push(item);
    }
  });

  return groupedItems;
}

function extractVisualizationRows({
  chart,
  datasets,
  filters = [],
  variables = {},
  timezone = "",
}) {
  const exportData = {};
  const conditionsOptions = [];

  datasets.forEach((dataset, index) => {
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

    const collectionItems = getCollectionItems(
      filteringResult.filteredData,
      dataset?.options?.xAxis || "",
    );
    const groupedItems = applyGroupBy(
      applyGroupMappings(collectionItems, dataset?.options || {}),
      dataset?.options?.groupBy,
    );

    exportData[dataset?.options?.legend || cdc?.legend || `Dataset ${index + 1}`] = groupedItems;
  });

  return {
    configuration: exportData,
    conditionsOptions,
  };
}

module.exports = {
  applyGroupBy,
  applyGroupMappings,
  extractVisualizationRows,
  getCollectionItems,
};
