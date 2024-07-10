const moment = require("moment");
const ChartController = require("../../controllers/ChartController");
const { checkChartForAlerts } = require("../alerts/checkAlerts");

const chartController = new ChartController();

async function updateDate(chart) {
  if (moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment())) {
    try {
      await chartController.update(chart.id, { lastAutoUpdate: moment() });
      return true;
    } catch (error) {
      return false;
    }
  }

  return true;
}

async function runUpdate(chart) {
  const chartData = await chartController.updateChartData(chart.id, null, {});
  checkChartForAlerts(chartData);
  const dateUpdated = await updateDate(chart);
  if (!dateUpdated) {
    throw new Error(`Failed to update date for chart ${chart.id}`);
  }
  return true;
}

module.exports = async (job) => {
  const chart = job.data;
  const chartToUpdate = chart.dataValues ? chart.dataValues : chart;

  const dateUpdated = await updateDate(chartToUpdate);
  if (!dateUpdated) {
    throw new Error(`Failed to update date for chart ${chartToUpdate.id}`);
  }
  await runUpdate(chartToUpdate);
  return true;
};
