const db = require("../models/models");
const { VisualizationEngine } = require("../visualization/VisualizationEngine");
const {
  assertPreparedData,
  serializePreparedDataSnapshot,
} = require("../visualization/preparedData");

const DEFAULT_PREPARED_SNAPSHOT_MAX_BYTES = 5 * 1024 * 1024;

function parsePositiveInt(value, fallback) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) return fallback;
  return parsedValue;
}

function getPreparedSnapshotMaxBytes() {
  return parsePositiveInt(
    process.env.CB_PREPARED_SNAPSHOT_MAX_BYTES,
    DEFAULT_PREPARED_SNAPSHOT_MAX_BYTES
  );
}

function toPlainChart(chart) {
  if (!chart) return chart;
  const plainChart = typeof chart.toJSON === "function" ? chart.toJSON() : { ...chart };
  delete plainChart.chartData;
  delete plainChart.chartDataUpdated;
  delete plainChart.preparedData;
  return plainChart;
}

function buildRenderEnvelope(compiled, preparedData, options = {}) {
  return {
    configuration: compiled.configuration,
    generatedAt: preparedData.generatedAt || null,
    renderer: compiled.renderer || "native",
    metadata: compiled.metadata || {},
    stale: Boolean(options.stale),
    tabularData: compiled.tabularData || {},
    updatedAt: options.updatedAt || preparedData.generatedAt || null,
    version: 1,
  };
}

function attachPreparedRender(chart, compiled, preparedData, options = {}) {
  const plainChart = toPlainChart(chart);
  const render = buildRenderEnvelope(compiled, preparedData, options);
  return {
    ...plainChart,
    dateFormat: compiled.dateFormat,
    isTimeseries: compiled.isTimeseries,
    preparedDataUpdatedAt: options.snapshotUpdatedAt
      || plainChart.preparedDataUpdatedAt
      || null,
    render,
  };
}

function attachUnavailableRender(chart, options = {}) {
  const plainChart = toPlainChart(chart);
  return {
    ...plainChart,
    render: null,
    stale: Boolean(options.stale),
  };
}

function compilePreparedRender(chart, preparedData, options = {}) {
  const validatedPreparedData = assertPreparedData(preparedData);
  const compiled = new VisualizationEngine({
    chart,
    datasets: [],
    timezone: options.timezone || validatedPreparedData.timezone,
  }).renderPrepared(validatedPreparedData, {
    timezone: options.timezone || validatedPreparedData.timezone,
  });
  return attachPreparedRender(chart, compiled, validatedPreparedData, options);
}

async function loadPreparedSnapshot(chartId, options = {}) {
  const chart = await db.Chart.unscoped().findOne({
    attributes: [
      "id",
      "preparedData",
      "preparedDataFingerprint",
      "preparedDataSourceFingerprint",
      "preparedDataUpdatedAt",
      "preparedDataVisualizationFingerprint",
    ],
    transaction: options.transaction,
    where: { id: chartId },
  });
  if (!chart?.preparedData) return null;

  try {
    return {
      fingerprint: chart.preparedDataFingerprint || null,
      preparedData: assertPreparedData(chart.preparedData),
      sourceFingerprint: chart.preparedDataSourceFingerprint || null,
      updatedAt: chart.preparedDataUpdatedAt || null,
      visualizationFingerprint: chart.preparedDataVisualizationFingerprint || null,
    };
  } catch (error) {
    console.error(`[prepared-snapshot] Invalid snapshot for chart ${chartId}: ${error.message}`); // oxlint-disable-line no-console
    return null;
  }
}

async function loadPreparedSnapshots(chartIds, options = {}) {
  const normalizedIds = [...new Set((chartIds || []).map(Number).filter(Number.isInteger))];
  if (normalizedIds.length === 0) return new Map();
  const charts = await db.Chart.unscoped().findAll({
    attributes: [
      "id",
      "preparedData",
      "preparedDataFingerprint",
      "preparedDataSourceFingerprint",
      "preparedDataUpdatedAt",
      "preparedDataVisualizationFingerprint",
    ],
    transaction: options.transaction,
    where: { id: normalizedIds },
  });
  return charts.reduce((snapshots, chart) => {
    if (!chart.preparedData) return snapshots;
    try {
      snapshots.set(Number(chart.id), {
        fingerprint: chart.preparedDataFingerprint || null,
        preparedData: assertPreparedData(chart.preparedData),
        sourceFingerprint: chart.preparedDataSourceFingerprint || null,
        updatedAt: chart.preparedDataUpdatedAt || null,
        visualizationFingerprint: chart.preparedDataVisualizationFingerprint || null,
      });
    } catch (error) {
      console.error(`[prepared-snapshot] Invalid snapshot for chart ${chart.id}: ${error.message}`); // oxlint-disable-line no-console
    }
    return snapshots;
  }, new Map());
}

async function persistPreparedSnapshot({
  chartId,
  fingerprints,
  preparedData,
  transaction,
}) {
  const serialized = serializePreparedDataSnapshot(preparedData);
  const sizeBytes = Buffer.byteLength(serialized, "utf8");
  const maxBytes = getPreparedSnapshotMaxBytes();
  if (sizeBytes > maxBytes) {
    console.warn("[prepared-snapshot] size_limit_exceeded", { // oxlint-disable-line no-console
      chartId,
      maxBytes,
      sizeBytes,
    });
    return {
      maxBytes,
      reason: "size_limit_exceeded",
      saved: false,
      sizeBytes,
    };
  }

  const updatedAt = new Date(preparedData.generatedAt || Date.now());
  await db.Chart.unscoped().update({
    preparedData: JSON.parse(serialized),
    preparedDataFingerprint: fingerprints.combined,
    preparedDataSourceFingerprint: fingerprints.source,
    preparedDataUpdatedAt: updatedAt,
    preparedDataVisualizationFingerprint: fingerprints.visualization,
  }, {
    transaction,
    where: { id: chartId },
  });

  return {
    maxBytes,
    reason: null,
    saved: true,
    sizeBytes,
    updatedAt,
  };
}

module.exports = {
  DEFAULT_PREPARED_SNAPSHOT_MAX_BYTES,
  attachUnavailableRender,
  attachPreparedRender,
  buildRenderEnvelope,
  compilePreparedRender,
  getPreparedSnapshotMaxBytes,
  loadPreparedSnapshot,
  loadPreparedSnapshots,
  persistPreparedSnapshot,
};
