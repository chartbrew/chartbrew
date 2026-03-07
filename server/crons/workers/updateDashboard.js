const { DateTime } = require("luxon");
const { Op } = require("sequelize");

const ChartController = require("../../controllers/ChartController");
const db = require("../../models/models");
const { checkChartForAlerts } = require("../../modules/alerts/checkAlerts");

const chartController = new ChartController();
function parsePositiveInt(value, fallback) {
  const parsedValue = parseInt(value, 10);
  if (Number.isNaN(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

const DASHBOARD_CHART_UPDATE_CONCURRENCY = parsePositiveInt(
  process.env.CB_DASHBOARD_CHART_UPDATE_CONCURRENCY,
  2
);

async function runWithConcurrency(items, workerFn, concurrency) {
  if (!items || items.length === 0) {
    return;
  }

  const maxConcurrency = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  const processNext = async () => {
    if (nextIndex >= items.length) {
      return;
    }

    const currentIndex = nextIndex;
    nextIndex += 1;
    await workerFn(items[currentIndex]);
    await processNext();
  };

  const runners = Array.from({ length: maxConcurrency }, async () => processNext());

  await Promise.all(runners);
}

async function updateChart(chart) {
  try {
    const chartData = await chartController.updateChartData(chart.id, null, {});
    checkChartForAlerts(chartData);
    return { success: true, chartId: chart.id };
  } catch (error) {
    return { success: false, chartId: chart.id, error: error.message };
  }
}

module.exports = async (job) => {
  try {
    const dashboard = job.data;
    const charts = await db.Chart.findAll({
      where: { project_id: dashboard.id, type: { [Op.not]: "markdown" } },
      attributes: ["id"],
    });

    await runWithConcurrency(charts, updateChart, DASHBOARD_CHART_UPDATE_CONCURRENCY);

    await db.Project.update(
      { lastUpdatedAt: DateTime.now().toJSDate() },
      { where: { id: dashboard.id } }
    );

    return true;
  } catch (error) {
    throw new Error(error);
  }
};
