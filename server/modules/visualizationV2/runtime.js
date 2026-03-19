const AxisChart = require("../../charts/AxisChart");
const TableView = require("../../charts/TableView");
const { getDatasetDisplayName } = require("../datasetIdentity");
const { buildVisualizationFilterPlan } = require("./filterPlan");
const { resolveSelectorLegacyPath, toPlainObject } = require("./selectors");
const { frameToChartData, frameToMatrixChartData } = require("./chartDataCompat");
const { extractVisualizationRows } = require("./rowDataCompat");
const { VizFrameCompatibilityError, buildVizFrame } = require("./vizFrame");

function normalizeAggregation(aggregation) {
  if (aggregation === "countUnique") {
    return "count_unique";
  }

  return aggregation || "none";
}

function getPrimaryDimension(vizConfig = {}) {
  const dimensions = Array.isArray(vizConfig.dimensions) ? vizConfig.dimensions : [];

  return dimensions.find((dimension) => dimension?.role === "x" || dimension?.role === "table")
    || dimensions[0]
    || null;
}

function getPrimaryMetric(vizConfig = {}) {
  const metrics = Array.isArray(vizConfig.metrics) ? vizConfig.metrics : [];

  return metrics.find((metric) => metric?.enabled !== false)
    || metrics[0]
    || null;
}

function resolveLegacyPath(fieldId, datasetOptions = {}) {
  return resolveSelectorLegacyPath(fieldId, datasetOptions);
}

function buildRuntimeChartDatasetConfig(cdc, datasetOptions = {}) {
  const plainCdc = toPlainObject(cdc) || {};
  const vizConfig = plainCdc.vizConfig || {};
  const visualizationOptions = vizConfig.options?.visualization || {};
  const tableOptions = visualizationOptions.table || {};
  const primaryMetric = getPrimaryMetric(vizConfig);
  const formulaOperation = Array.isArray(vizConfig.postOperations)
    ? vizConfig.postOperations.find((operation) => operation?.type === "formula")
    : null;

  const mergedConfiguration = {
    ...(plainCdc.configuration || {}),
  };

  if (!mergedConfiguration.columnsFormatting && tableOptions.columnsFormatting) {
    mergedConfiguration.columnsFormatting = tableOptions.columnsFormatting;
  }

  if (!mergedConfiguration.sum && tableOptions.summaryField) {
    mergedConfiguration.sum = tableOptions.summaryField;
  }

  return {
    ...plainCdc,
    legend: plainCdc.legend || primaryMetric?.label || getDatasetDisplayName(datasetOptions),
    formula: plainCdc.formula || formulaOperation?.expression || null,
    sort: plainCdc.sort || vizConfig.sort?.[0]?.dir || null,
    maxRecords: plainCdc.maxRecords ?? vizConfig.limit ?? null,
    goal: plainCdc.goal ?? primaryMetric?.style?.goal ?? null,
    excludedFields: Array.isArray(plainCdc.excludedFields)
      ? plainCdc.excludedFields
      : (tableOptions.excludedFields || []),
    columnsOrder: Array.isArray(plainCdc.columnsOrder)
      ? plainCdc.columnsOrder
      : (tableOptions.columnsOrder || []),
    configuration: Object.keys(mergedConfiguration).length > 0 ? mergedConfiguration : null,
  };
}

function buildRuntimeDatasetOptions(datasetOptions, runtimeCdc) {
  const plainDatasetOptions = toPlainObject(datasetOptions) || {};
  const vizConfig = runtimeCdc?.vizConfig || {};
  const compatibility = vizConfig.options?.compatibility || {};
  const primaryDimension = getPrimaryDimension(vizConfig);
  const primaryMetric = getPrimaryMetric(vizConfig);

  const xAxis = resolveLegacyPath(
    primaryDimension?.fieldId || compatibility.legacyDimensionFieldId,
    plainDatasetOptions,
  ) || plainDatasetOptions.xAxis || null;
  const yAxis = resolveLegacyPath(
    primaryMetric?.fieldId || compatibility.legacyMetricFieldId,
    plainDatasetOptions,
  ) || plainDatasetOptions.yAxis || null;
  const dateField = resolveLegacyPath(
    compatibility.legacyDateFieldId,
    plainDatasetOptions,
  ) || plainDatasetOptions.dateField || null;

  return {
    ...plainDatasetOptions,
    cdcId: runtimeCdc?.id || plainDatasetOptions.cdcId || null,
    legend:
      runtimeCdc?.legend
      || plainDatasetOptions.legend
      || getDatasetDisplayName(plainDatasetOptions),
    xAxis,
    yAxis,
    yAxisOperation: primaryMetric
      ? normalizeAggregation(primaryMetric.aggregation)
      : (plainDatasetOptions.yAxisOperation || "none"),
    dateField,
    dateFormat: compatibility.legacyDateFormat || plainDatasetOptions.dateFormat || null,
    excludedFields: runtimeCdc?.excludedFields || plainDatasetOptions.excludedFields || [],
    columnsOrder: runtimeCdc?.columnsOrder || plainDatasetOptions.columnsOrder || [],
    configuration: runtimeCdc?.configuration || plainDatasetOptions.configuration || null,
  };
}

function createVisualizationRuntimePayload(chart, datasets = []) {
  const runtimeChart = toPlainObject(chart) || {};
  const runtimeCdcs = Array.isArray(runtimeChart.ChartDatasetConfigs)
    ? runtimeChart.ChartDatasetConfigs.map((cdc, index) => {
      return buildRuntimeChartDatasetConfig(cdc, datasets[index]?.options);
    })
    : [];

  runtimeChart.ChartDatasetConfigs = runtimeCdcs;

  const runtimeDatasets = datasets.map((dataset, index) => {
    const plainDataset = toPlainObject(dataset) || {};
    const runtimeOptions = buildRuntimeDatasetOptions(plainDataset.options, runtimeCdcs[index]);
    runtimeCdcs[index].Dataset = runtimeOptions;

    return {
      ...plainDataset,
      options: runtimeOptions,
    };
  });

  return {
    chart: runtimeChart,
    datasets: runtimeDatasets,
  };
}

function isVisualizationV2Chart(chart = {}) {
  if (!Array.isArray(chart?.ChartDatasetConfigs) || chart.ChartDatasetConfigs.length === 0) {
    return false;
  }

  return chart.ChartDatasetConfigs.every((cdc) => {
    return Number.parseInt(cdc?.vizVersion, 10) === 2 && Boolean(cdc?.vizConfig);
  });
}

function canUseVizFrameRuntime(chart = {}) {
  return chart?.type !== "table";
}

function runVisualizationV2({
  chart,
  datasets,
  filters,
  variables,
  timezone,
  isExport = false,
  skipParsing = false,
}) {
  const baseRuntimeData = createVisualizationRuntimePayload(chart, datasets);
  const filterPlan = buildVisualizationFilterPlan({
    chart: baseRuntimeData.chart,
    datasets: baseRuntimeData.datasets,
    filters,
    variables,
  });
  const runtimeData = {
    chart: baseRuntimeData.chart,
    datasets: filterPlan.datasets,
  };
  const runtimeFilters = filterPlan.filters;

  if (isExport) {
    return extractVisualizationRows({
      chart: runtimeData.chart,
      datasets: runtimeData.datasets,
      filters: runtimeFilters,
      variables,
      timezone,
    });
  }

  if (runtimeData.chart?.type === "table") {
    const extractedData = extractVisualizationRows({
      chart: runtimeData.chart,
      datasets: runtimeData.datasets,
      filters: runtimeFilters,
      variables,
      timezone,
    });
    const tableView = new TableView();
    return tableView.getTableData(extractedData, runtimeData, timezone);
  }

  if (!skipParsing && canUseVizFrameRuntime(runtimeData.chart)) {
    try {
      const frame = buildVizFrame({
        chart: runtimeData.chart,
        datasets: runtimeData.datasets,
        filters: runtimeFilters,
        variables,
        timezone,
      });

      if (runtimeData.chart?.type === "matrix") {
        return frameToMatrixChartData({
          chart: runtimeData.chart,
          datasets: runtimeData.datasets,
          frame,
          timezone,
        });
      }

      return frameToChartData({
        chart: runtimeData.chart,
        datasets: runtimeData.datasets,
        frame,
      });
    } catch (error) {
      if (!(error instanceof VizFrameCompatibilityError)) {
        throw error;
      }
    }
  }

  let shouldSkipParsing = skipParsing;
  if (!runtimeData.chart?.chartData) {
    shouldSkipParsing = false;
  }

  const axisChart = new AxisChart(runtimeData, timezone);
  return axisChart.plot(shouldSkipParsing, runtimeFilters, variables);
}

module.exports = {
  buildRuntimeChartDatasetConfig,
  buildRuntimeDatasetOptions,
  canUseVizFrameRuntime,
  createVisualizationRuntimePayload,
  isVisualizationV2Chart,
  normalizeAggregation,
  resolveLegacyPath,
  runVisualizationV2,
};
