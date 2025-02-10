const { DateTime } = require("luxon");
const { Op } = require("sequelize");

const ChartController = require("../../controllers/ChartController");
const db = require("../../models/models");
const { checkChartForAlerts } = require("../../modules/alerts/checkAlerts");

const chartController = new ChartController();

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

    await Promise.all(charts.map(updateChart));

    await db.Project.update(
      { lastUpdatedAt: DateTime.now().toJSDate() },
      { where: { id: dashboard.id } }
    );

    return true;
  } catch (error) {
    throw new Error(error);
  }
};
