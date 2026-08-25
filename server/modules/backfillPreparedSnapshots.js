const { Op } = require("sequelize");

const ChartController = require("../controllers/ChartController");
const db = require("../models/models");

function parsePositiveInt(value, fallback) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) return fallback;
  return parsedValue;
}

async function backfillPreparedSnapshots(options = {}) {
  const batchSize = parsePositiveInt(options.batchSize, 25);
  const limit = options.limit ? parsePositiveInt(options.limit, null) : null;
  const controller = options.controller || new ChartController();
  const report = {
    failed: 0,
    failures: [],
    lastChartId: Number(options.afterId) || 0,
    processed: 0,
    saved: 0,
    skipped: 0,
  };

  while (!limit || report.processed < limit) {
    const remaining = limit ? limit - report.processed : batchSize;
    const charts = await db.Chart.unscoped().findAll({ // oxlint-disable-line no-await-in-loop
      attributes: ["id", "preparedData"],
      limit: Math.min(batchSize, remaining),
      order: [["id", "ASC"]],
      where: {
        id: { [Op.gt]: report.lastChartId },
        ...(options.force ? {} : { preparedData: { [Op.is]: null } }),
      },
    });
    if (charts.length === 0) break;

    for (const chart of charts) {
      report.lastChartId = Number(chart.id);
      report.processed += 1;
      try {
        const result = await controller.updateChartData(chart.id, null, { // oxlint-disable-line no-await-in-loop
          finalizeRun: false,
          getCache: false,
          noSource: false,
          returnPreparedData: true,
          traceContext: null,
        });
        if (result.snapshot?.saved) {
          report.saved += 1;
        } else {
          report.skipped += 1;
        }
      } catch (error) {
        report.failed += 1;
        report.failures.push({
          chartId: chart.id,
          message: error.message || `${error}`,
        });
      }
    }
  }

  return report;
}

module.exports = {
  backfillPreparedSnapshots,
};
