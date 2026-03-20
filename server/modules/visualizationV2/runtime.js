const AxisChart = require("../../charts/AxisChart");
const { getDatasetDisplayName } = require("../datasetIdentity");
const { buildVisualizationFilterPlan } = require("./filterPlan");
const { resolveSelectorLegacyPath, toPlainObject } = require("./selectors");
const {
  frameToChartData,
  frameToExportData,
  frameToMatrixChartData,
  frameToTableData,
} = require("./chartDataCompat");
const { extractVisualizationRows } = require("./rowDataCompat");
const { VizFrameCompatibilityError, buildVizFrame } = require("./vizFrame");

const SYNTHETIC_COUNT_FIELD_ID = "__cb_row_count__";

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

function isSyntheticCountMetric(metric = null) {
  return metric?.synthetic === "rowCount" || metric?.fieldId === SYNTHETIC_COUNT_FIELD_ID;
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
  const dimensionFieldId = primaryDimension?.fieldId || compatibility.legacyDimensionFieldId || null;
  const metricFieldId = primaryMetric?.fieldId || compatibility.legacyMetricFieldId || null;
  const dateFieldId = compatibility.legacyDateFieldId
    || (primaryDimension?.grain ? primaryDimension.fieldId : null)
    || null;
  const xAxis = resolveLegacyPath(
    dimensionFieldId,
    plainDatasetOptions,
  ) || null;
  const fallbackToCountMetric = isSyntheticCountMetric(primaryMetric)
    || !metricFieldId;
  const yAxis = fallbackToCountMetric
    ? (xAxis || resolveLegacyPath(dateFieldId, plainDatasetOptions) || null)
    : (
      resolveLegacyPath(
        metricFieldId,
        plainDatasetOptions,
      ) || null
    );
  const dateField = resolveLegacyPath(
    dateFieldId,
    plainDatasetOptions,
  ) || null;

  return {
    ...plainDatasetOptions,
    cdcId: runtimeCdc?.id || plainDatasetOptions.cdcId || null,
    legend:
      runtimeCdc?.legend
      || plainDatasetOptions.legend
      || getDatasetDisplayName(plainDatasetOptions),
    xAxis,
    yAxis,
    yAxisOperation: fallbackToCountMetric
      ? "count"
      : (primaryMetric
        ? normalizeAggregation(primaryMetric.aggregation)
        : (plainDatasetOptions.yAxisOperation || "none")),
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
  return Boolean(chart?.type);
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

  if (!skipParsing && canUseVizFrameRuntime(runtimeData.chart)) {
    try {
      const frame = buildVizFrame({
        chart: runtimeData.chart,
        datasets: runtimeData.datasets,
        filters: runtimeFilters,
        variables,
        timezone,
      });

      if (isExport) {
        return frameToExportData({
          chart: runtimeData.chart,
          frame,
        });
      }

      if (runtimeData.chart?.type === "table") {
        return frameToTableData({
          chart: runtimeData.chart,
          datasets: runtimeData.datasets,
          frame,
          timezone,
        });
      }

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
    return frameToTableData({
      chart: runtimeData.chart,
      datasets: runtimeData.datasets,
      frame: {
        datasetExecutions: runtimeData.datasets.map((dataset, index) => ({
          datasetId: dataset?.options?.id || null,
          label:
            runtimeData.chart?.ChartDatasetConfigs?.[index]?.legend
            || dataset?.options?.legend
            || getDatasetDisplayName(dataset?.options || {}),
          filteredItems: extractVisualizationRows({
            chart: runtimeData.chart,
            datasets: [dataset],
            filters: runtimeFilters,
            variables,
            timezone,
          }).configuration[
            runtimeData.chart?.ChartDatasetConfigs?.[index]?.legend
            || dataset?.options?.legend
            || getDatasetDisplayName(dataset?.options || {})
          ] || [],
        })),
        conditionsOptions: extractVisualizationRows({
          chart: runtimeData.chart,
          datasets: runtimeData.datasets,
          filters: runtimeFilters,
          variables,
          timezone,
        }).conditionsOptions,
      },
      timezone,
    });
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
