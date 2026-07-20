const Sequelize = require("sequelize");
const { legacyChartToVisualization } = require("../../visualization/legacyChartToVisualization");

const CHART_FIELDS = [
  "id",
  "type",
  "subType",
  "mode",
  "draft",
  "content",
  "stacked",
  "horizontal",
  "displayLegend",
  "dataLabels",
  "startDate",
  "endDate",
  "currentEndDate",
  "fixedStartDate",
  "includeZeros",
  "isLogarithmic",
  "maxValue",
  "minValue",
  "timeInterval",
  "xLabelTicks",
  "dashedLastPoint",
  "visualization",
];

const CDC_FIELDS = [
  "id",
  "chart_id",
  "dataset_id",
  "xAxis",
  "xAxisOperation",
  "yAxis",
  "yAxisOperation",
  "dateField",
  "dateFormat",
  "legend",
  "conditions",
  "formula",
  "datasetColor",
  "fillColor",
  "fill",
  "multiFill",
  "pointRadius",
  "excludedFields",
  "sort",
  "columnsOrder",
  "order",
  "maxRecords",
  "goal",
  "configuration",
];

const DATASET_FIELDS = [
  "id",
  "name",
  "legend",
  "xAxis",
  "xAxisOperation",
  "yAxis",
  "yAxisOperation",
  "dateField",
  "dateFormat",
  "conditions",
  "formula",
  "datasetColor",
  "fillColor",
  "fill",
  "multiFill",
  "pointRadius",
  "excludedFields",
  "sort",
  "columnsOrder",
  "maxRecords",
  "goal",
  "configuration",
  "fieldsSchema",
];

const JSON_FIELDS = new Set([
  "conditions",
  "fillColor",
  "excludedFields",
  "columnsOrder",
  "configuration",
  "fieldsSchema",
]);

function buildSelectQuery(queryInterface, tableName, columns) {
  const queryGenerator = queryInterface.queryGenerator
    || queryInterface.sequelize.getQueryInterface().queryGenerator;
  const quotedTable = queryGenerator.quoteTable(tableName);
  const quotedColumns = columns.map((column) => {
    const quotedColumn = queryGenerator.quoteIdentifier(column);
    return `${quotedColumn} AS ${quotedColumn}`;
  });

  return `SELECT ${quotedColumns.join(", ")} FROM ${quotedTable}`;
}

function parseJsonField(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function hydrateRow(row) {
  return Object.entries(row).reduce((hydrated, [key, value]) => {
    hydrated[key] = JSON_FIELDS.has(key) ? parseJsonField(value) : value;
    return hydrated;
  }, {});
}

function hasVisualization(value) {
  const parsed = parseJsonField(value);
  return parsed && typeof parsed === "object" && parsed.version === 2;
}

function hasLegacyVisualization(value) {
  const parsed = parseJsonField(value);
  return hasVisualization(parsed) && parsed.metadata?.migratedFrom === "legacy";
}

async function runBatches(items, batchSize, callback, index = 0) {
  if (index >= items.length) return;
  const batch = items.slice(index, index + batchSize);
  await Promise.all(batch.map((item) => callback(item)));
  return runBatches(items, batchSize, callback, index + batchSize);
}

async function migrateChartVisualization(queryInterface, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const refreshLegacy = Boolean(options.refreshLegacy);
  const batchSize = options.batchSize || 25;
  const chartFields = options.hasVisualizationColumn === false
    ? CHART_FIELDS.filter((field) => field !== "visualization")
    : CHART_FIELDS;
  const [charts, cdcs, datasets] = await Promise.all([
    queryInterface.sequelize.query(
      buildSelectQuery(queryInterface, "Chart", chartFields),
      { type: Sequelize.QueryTypes.SELECT }
    ),
    queryInterface.sequelize.query(
      buildSelectQuery(queryInterface, "ChartDatasetConfig", CDC_FIELDS),
      { type: Sequelize.QueryTypes.SELECT }
    ),
    queryInterface.sequelize.query(
      buildSelectQuery(queryInterface, "Dataset", DATASET_FIELDS),
      { type: Sequelize.QueryTypes.SELECT }
    ),
  ]);
  const datasetById = new Map(datasets.map((dataset) => {
    const hydrated = hydrateRow(dataset);
    return [hydrated.id, hydrated];
  }));
  const cdcsByChartId = cdcs.reduce((grouped, cdc) => {
    const hydrated = hydrateRow(cdc);
    const chartCdcs = grouped.get(hydrated.chart_id) || [];
    chartCdcs.push({
      ...hydrated,
      Dataset: datasetById.get(hydrated.dataset_id) || null,
    });
    grouped.set(hydrated.chart_id, chartCdcs);
    return grouped;
  }, new Map());
  const report = {
    draft: 0,
    failed: 0,
    failures: [],
    migrated: 0,
    orphan: 0,
    refreshed: 0,
    skipped: 0,
    total: charts.length,
  };

  await runBatches(charts, batchSize, async (chartRow) => {
    const hasStoredVisualization = hasVisualization(chartRow.visualization);
    const shouldRefresh = refreshLegacy && hasLegacyVisualization(chartRow.visualization);
    if (hasStoredVisualization && !shouldRefresh) {
      report.skipped += 1;
      return;
    }

    const chart = {
      ...hydrateRow(chartRow),
      ChartDatasetConfigs: (cdcsByChartId.get(chartRow.id) || [])
        .sort((left, right) => (left.order || 0) - (right.order || 0)),
    };

    try {
      const result = legacyChartToVisualization(chart);
      if (!result.valid) {
        report.failed += 1;
        report.failures.push({ chartId: chart.id, errors: result.errors });
        return;
      }

      if (result.visualization.status === "draft") report.draft += 1;
      if (result.visualization.status === "orphan") report.orphan += 1;

      if (!dryRun) {
        await queryInterface.bulkUpdate(
          "Chart",
          { visualization: JSON.stringify(result.visualization) },
          { id: chart.id }
        );
      }
      if (shouldRefresh) report.refreshed += 1;
      else report.migrated += 1;
    } catch (error) {
      report.failed += 1;
      report.failures.push({ chartId: chart.id, errors: [error.message] });
    }
  });

  return report;
}

module.exports = {
  CDC_FIELDS,
  CHART_FIELDS,
  DATASET_FIELDS,
  buildSelectQuery,
  hydrateRow,
  hasLegacyVisualization,
  migrateChartVisualization,
};
