const Sequelize = require("sequelize");

function parseVisualization(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function getVisualizationTimeFields(value) {
  const visualization = parseVisualization(value);
  return (visualization?.layers || []).reduce((fields, layer) => {
    if (layer.bindingId && layer.encoding?.time?.field && !fields.has(`${layer.bindingId}`)) {
      fields.set(`${layer.bindingId}`, layer.encoding.time.field);
    }
    return fields;
  }, new Map());
}

async function backfillVisualizationDateFields(queryInterface, options = {}) {
  const queryGenerator = queryInterface.queryGenerator
    || queryInterface.sequelize.getQueryInterface().queryGenerator;
  const chartTable = queryGenerator.quoteTable("Chart");
  const cdcTable = queryGenerator.quoteTable("ChartDatasetConfig");
  const idColumn = queryGenerator.quoteIdentifier("id");
  const visualizationColumn = queryGenerator.quoteIdentifier("visualization");
  const chartIdColumn = queryGenerator.quoteIdentifier("chart_id");
  const dateFieldColumn = queryGenerator.quoteIdentifier("dateField");
  const [charts, cdcs] = await Promise.all([
    queryInterface.sequelize.query(
      `SELECT ${idColumn}, ${visualizationColumn} FROM ${chartTable} `
        + `WHERE ${visualizationColumn} IS NOT NULL`,
      { type: Sequelize.QueryTypes.SELECT }
    ),
    queryInterface.sequelize.query(
      `SELECT ${idColumn}, ${chartIdColumn}, ${dateFieldColumn} FROM ${cdcTable}`,
      { type: Sequelize.QueryTypes.SELECT }
    ),
  ]);
  const fieldsByChart = new Map(charts.map((chart) => {
    return [chart.id, getVisualizationTimeFields(chart.visualization)];
  }));
  const updates = cdcs.flatMap((cdc) => {
    if (cdc.dateField) return [];
    const field = fieldsByChart.get(cdc.chart_id)?.get(`${cdc.id}`);
    return field ? [{ field, id: cdc.id }] : [];
  });

  if (!options.dryRun) {
    for (const update of updates) {
      // eslint-disable-next-line no-await-in-loop -- keep the migration load predictable on large installations
      await queryInterface.bulkUpdate(
        "ChartDatasetConfig",
        { dateField: update.field },
        { id: update.id }
      );
    }
  }

  return {
    scanned: cdcs.length,
    skipped: cdcs.length - updates.length,
    updated: updates.length,
  };
}

module.exports = {
  backfillVisualizationDateFields,
  getVisualizationTimeFields,
  parseVisualization,
};
