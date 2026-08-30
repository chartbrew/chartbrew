const { resolveChartDatasetOptions } = require("../modules/resolveChartDatasetOptions");
const { resolveVisualization } = require("./VisualizationEngine");
const {
  FRAME_VERSION,
} = require("./frameBuilder");
const {
  PREPARED_DATA_VERSION,
  SERIES_IDENTITY_VERSION,
  inferFieldType,
} = require("./preparedData");
const { createSeriesId, serializeTypedValue } = require("./seriesIdentity");

const CATEGORY_MARKS = new Set([
  "bar",
  "doughnut",
  "horizontalBar",
  "line",
  "pie",
  "polar",
  "radar",
]);
const METRIC_MARKS = new Set(["avg", "gauge", "kpi"]);

function parseLegacyChartData(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function getGeneratedAt(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getChartDatasetOptions(chart, bindingId) {
  const cdc = (chart.ChartDatasetConfigs || []).find((item) => {
    return `${item.id}` === `${bindingId}`;
  });
  if (!cdc) return {};
  const plainCdc = typeof cdc.toJSON === "function" ? cdc.toJSON() : cdc;
  const dataset = plainCdc.Dataset || {};
  return resolveChartDatasetOptions(plainCdc, dataset);
}

function getSourceOptions(chart, layer) {
  const options = getChartDatasetOptions(chart, layer.bindingId);
  return [
    "columnsOrder",
    "configuration",
    "excludedFields",
    "groupBy",
    "groups",
    "legend",
    "name",
  ].reduce((result, key) => {
    if (options[key] !== undefined) result[key] = options[key];
    return result;
  }, {});
}

function getLegacySeriesMetadata(chartData) {
  return [...(chartData.meta?.series || []), ...(chartData.meta?.availableSeries || [])]
    .reduce((metadata, series) => {
      if (series?.id && !metadata.has(series.id)) metadata.set(series.id, series);
      return metadata;
    }, new Map());
}

function findSeriesMetadata(dataset, seriesMetadata) {
  if (dataset.id && seriesMetadata.has(dataset.id)) return seriesMetadata.get(dataset.id);
  return [...seriesMetadata.values()].find((series) => series.label === dataset.label) || null;
}

function resolveDatasetLayer(dataset, index, layers, seriesMetadata) {
  if (dataset.layerId) {
    const exact = layers.find((layer) => `${layer.id}` === `${dataset.layerId}`);
    if (exact) return exact;
  }
  const metadata = findSeriesMetadata(dataset, seriesMetadata);
  if (metadata?.layerId) {
    const layerId = metadata.layerId;
    const exact = layers.find((layer) => `${layer.id}` === `${layerId}`);
    if (exact) return exact;
  }
  const labelMatch = layers.find((layer) => layer.name && layer.name === dataset.label);
  return labelMatch || layers[index] || null;
}

function createSeries(dataset, layer, multipleForLayer, seriesMetadata) {
  const metadata = findSeriesMetadata(dataset, seriesMetadata);
  const seriesValue = metadata?.value
    ?? (multipleForLayer ? dataset.label || `Series ${dataset.index + 1}` : null);
  const id = metadata?.id
    || dataset.id
    || createSeriesId(layer.id, multipleForLayer ? seriesValue : "__default__");
  return {
    id,
    key: metadata?.key || serializeTypedValue(multipleForLayer ? seriesValue : "__default__"),
    label: dataset.label || metadata?.label || layer.name || "Series",
    value: seriesValue,
  };
}

function buildSeriesResults(chart, chartData, visualization) {
  const configuration = chartData.configuration || chartData;
  const labels = configuration.data?.labels;
  const datasets = configuration.data?.datasets;
  if (!Array.isArray(labels) || !Array.isArray(datasets) || datasets.length === 0) {
    throw new Error("Legacy chart data has no labels or datasets");
  }

  const seriesMetadata = getLegacySeriesMetadata(configuration);
  const assignments = datasets.map((dataset, index) => ({
    dataset: { ...dataset, index },
    layer: resolveDatasetLayer(dataset, index, visualization.layers, seriesMetadata),
  }));
  if (assignments.some((assignment) => !assignment.layer)) {
    throw new Error("Legacy chart series cannot be matched to a visualization layer");
  }

  const grouped = assignments.reduce((result, assignment) => {
    const key = assignment.layer.id;
    if (!result.has(key)) result.set(key, { layer: assignment.layer, datasets: [] });
    result.get(key).datasets.push(assignment.dataset);
    return result;
  }, new Map());

  return [...grouped.values()].map(({ layer, datasets: layerDatasets }) => {
    const dimensionKey = METRIC_MARKS.has(layer.mark) ? null : "category";
    const multipleForLayer = layerDatasets.length > 1;
    const series = layerDatasets.map((dataset) => {
      return createSeries(dataset, layer, multipleForLayer, seriesMetadata);
    });
    const rows = layerDatasets.flatMap((dataset, datasetIndex) => {
      const seriesItem = series[datasetIndex];
      const values = Array.isArray(dataset.data) ? dataset.data : [];
      if (!dimensionKey) {
        const value = values.length > 0 ? values[values.length - 1] : null;
        return [{ seriesId: seriesItem.id, value }];
      }
      return labels.map((label, valueIndex) => ({
        [dimensionKey]: label,
        seriesId: seriesItem.id,
        value: values[valueIndex] ?? null,
      }));
    });
    return {
      availableSeries: series,
      bindingId: layer.bindingId,
      fields: [
        ...(dimensionKey ? [{
          key: dimensionKey,
          role: "dimension",
          sourceField: null,
          type: "nominal",
        }] : []),
        { key: "value", role: "measure", sourceField: null, type: "quantitative" },
      ],
      id: layer.id,
      mark: layer.mark,
      name: layer.name || null,
      rows,
      series,
      sourceOptions: getSourceOptions(chart, layer),
      stats: { inputRows: rows.length, outputRows: rows.length },
      warnings: [],
    };
  });
}

function decodeTableValue(value) {
  if (typeof value !== "string") return value;
  const prefixes = ["__cb_array", "__cb_object"];
  const prefix = prefixes.find((item) => value.startsWith(item));
  if (!prefix) return value;
  try {
    return JSON.parse(value.slice(prefix.length));
  } catch (error) {
    return value;
  }
}

function restoreTableRow(row, columns = []) {
  const restored = {};
  const nestedAccessors = new Map(columns.flatMap((column) => {
    return (column.columns || []).map((nested) => [nested.accessor, {
      child: nested.Header,
      parent: column.Header,
    }]);
  }));

  Object.entries(row || {}).forEach(([key, value]) => {
    const nested = nestedAccessors.get(key);
    if (!nested) {
      restored[key] = decodeTableValue(value);
      return;
    }
    if (!restored[nested.parent]) restored[nested.parent] = {};
    restored[nested.parent][nested.child] = decodeTableValue(value);
  });
  return restored;
}

function buildTableResults(chart, chartData, visualization) {
  const tabs = Object.entries(chartData.configuration || chartData)
    .filter(([, value]) => Array.isArray(value?.data));
  if (tabs.length === 0) throw new Error("Legacy table data has no rows");

  return tabs.map(([name, tab], index) => {
    const layer = visualization.layers.find((item) => item.name === name)
      || visualization.layers[index];
    if (!layer) throw new Error(`Legacy table ${name} has no visualization layer`);
    const rows = tab.data.map((row) => restoreTableRow(row, tab.columns));
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return {
      availableSeries: [],
      bindingId: layer.bindingId,
      fields: keys.map((key) => ({
        key,
        role: "dimension",
        sourceField: null,
        type: inferFieldType(rows.find((row) => row[key] !== undefined)?.[key]),
      })),
      id: layer.id,
      mark: "table",
      name,
      rows,
      series: [],
      sourceOptions: getSourceOptions(chart, layer),
      stats: { inputRows: rows.length, outputRows: rows.length },
      warnings: [],
    };
  });
}

function buildMatrixResults(chart, chartData, visualization) {
  const configuration = chartData.configuration || chartData;
  const dataset = configuration.data?.datasets?.[0];
  const layer = visualization.layers[0];
  if (!layer || !Array.isArray(dataset?.data)) {
    throw new Error("Legacy matrix data has no points");
  }
  const series = [{
    id: dataset.id || createSeriesId(layer.id, "__default__"),
    key: serializeTypedValue("__default__"),
    label: dataset.label || layer.name || "Value",
    value: null,
  }];
  const rows = dataset.data.map((point) => ({
    seriesId: series[0].id,
    time: point.x,
    value: point.v ?? point.value ?? 0,
  }));
  return [{
    availableSeries: series,
    bindingId: layer.bindingId,
    fields: [
      { key: "time", role: "dimension", sourceField: null, type: "temporal" },
      { key: "value", role: "measure", sourceField: null, type: "quantitative" },
    ],
    id: layer.id,
    mark: "matrix",
    name: layer.name || dataset.label || null,
    rows,
    series,
    sourceOptions: getSourceOptions(chart, layer),
    stats: { inputRows: rows.length, outputRows: rows.length },
    warnings: [],
  }];
}

function buildMarkdownResults(chart, visualization) {
  const layer = visualization.layers[0];
  if (!layer) throw new Error("Markdown chart has no visualization layer");
  return [{
    availableSeries: [],
    bindingId: layer.bindingId,
    fields: [{ key: "content", role: "dimension", sourceField: null, type: "nominal" }],
    id: layer.id,
    mark: "markdown",
    name: layer.name || chart.name || null,
    rows: [{ content: layer.content ?? chart.content ?? "" }],
    series: [],
    sourceOptions: {},
    stats: { inputRows: 1, outputRows: 1 },
    warnings: [],
  }];
}

function legacyChartDataToPreparedData(chart, options = {}) {
  const chartData = parseLegacyChartData(options.chartData ?? chart.chartData);
  const resolved = resolveVisualization(chart);
  const marks = new Set(resolved.visualization.layers.map((layer) => layer.mark));
  const hasMarkdown = marks.has("markdown");
  if (!chartData && !hasMarkdown) throw new Error("Legacy chart data is not available");
  if (marks.size !== 1) throw new Error("Legacy chart data requires one chart type");
  const [mark] = marks;
  let results;
  if (mark === "markdown") {
    results = buildMarkdownResults(chart, resolved.visualization);
  } else if (mark === "table") {
    results = buildTableResults(chart, chartData, resolved.visualization);
  } else if (mark === "matrix") {
    results = buildMatrixResults(chart, chartData, resolved.visualization);
  } else if (CATEGORY_MARKS.has(mark) || METRIC_MARKS.has(mark)) {
    results = buildSeriesResults(chart, chartData, resolved.visualization);
  } else {
    throw new Error(`Legacy chart type is not supported: ${mark}`);
  }

  const rowCount = results.reduce((total, result) => total + result.rows.length, 0);
  return {
    __legacyChartData: true,
    __valuesFinal: true,
    frameVersion: FRAME_VERSION,
    generatedAt: getGeneratedAt(options.generatedAt ?? chart.chartDataUpdated),
    identityVersion: SERIES_IDENTITY_VERSION,
    resource: { id: chart.id ?? null, kind: "chart" },
    results,
    stats: { inputRows: rowCount, outputRows: rowCount },
    timezone: options.timezone || "UTC",
    version: PREPARED_DATA_VERSION,
    warnings: [],
  };
}

module.exports = {
  legacyChartDataToPreparedData,
  parseLegacyChartData,
  restoreTableRow,
};
