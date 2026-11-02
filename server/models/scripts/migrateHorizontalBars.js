const Sequelize = require("sequelize");

const CHART_FIELDS = [
  "id",
  "type",
  "horizontal",
  "visualization",
  "preparedData",
];

function parseJson(value) {
  if (!value || typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function replaceMarks(value, from, to) {
  if (!value || typeof value !== "object") return value;
  const next = JSON.parse(JSON.stringify(value));
  if (Array.isArray(next.layers)) {
    next.layers = next.layers.map((layer) => layer.mark === from ? {
      ...layer,
      mark: to,
      orientation: "horizontal",
    } : layer);
  }
  if (Array.isArray(next.results)) {
    next.results = next.results.map((result) => result.mark === from ? {
      ...result,
      mark: to,
    } : result);
  }
  return next;
}

function transformHorizontalBarChart(chart, direction = "up") {
  const up = direction === "up";
  const sourceType = up ? "bar" : "horizontalBar";
  const targetType = up ? "horizontalBar" : "bar";
  const qualifies = up
    ? chart.type === sourceType && Boolean(chart.horizontal)
    : chart.type === sourceType;
  if (!qualifies) return null;

  const visualization = replaceMarks(parseJson(chart.visualization), sourceType, targetType);
  const preparedData = replaceMarks(parseJson(chart.preparedData), sourceType, targetType);
  return {
    horizontal: !up,
    preparedData: preparedData ? JSON.stringify(preparedData) : chart.preparedData,
    preparedDataFingerprint: null,
    preparedDataVisualizationFingerprint: null,
    type: targetType,
    visualization: visualization ? JSON.stringify(visualization) : chart.visualization,
  };
}

function buildSelectQuery(queryInterface) {
  const queryGenerator = queryInterface.queryGenerator
    || queryInterface.sequelize.getQueryInterface().queryGenerator;
  const columns = CHART_FIELDS.map((column) => {
    const quoted = queryGenerator.quoteIdentifier(column);
    return `${quoted} AS ${quoted}`;
  });
  return `SELECT ${columns.join(", ")} FROM ${queryGenerator.quoteTable("Chart")}`;
}

async function migrateHorizontalBars(queryInterface, options = {}) {
  const direction = options.direction === "down" ? "down" : "up";
  const charts = await queryInterface.sequelize.query(buildSelectQuery(queryInterface), {
    type: Sequelize.QueryTypes.SELECT,
  });
  const report = { migrated: 0, skipped: 0, total: charts.length };

  for (const chart of charts) {
    const update = transformHorizontalBarChart(chart, direction);
    if (update) {
      if (!options.dryRun) {
        await queryInterface.bulkUpdate("Chart", update, { id: chart.id }); // oxlint-disable-line no-await-in-loop
      }
      report.migrated += 1;
    } else {
      report.skipped += 1;
    }
  }

  return report;
}

module.exports = {
  CHART_FIELDS,
  buildSelectQuery,
  migrateHorizontalBars,
  replaceMarks,
  transformHorizontalBarChart,
};
