const moment = require("moment");
const ChartController = require("../../controllers/ChartController");
const { checkChartForAlerts } = require("../../modules/alerts/checkAlerts");

const chartController = new ChartController();

async function updateDate(chart) {
  if (moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment())) {
    try {
      await chartController.update(chart.id, { lastAutoUpdate: moment() });
      return true;
    } catch (e) {
      throw new Error(e);
    }
  }

  return true;
}

async function runUpdate(chart) {
  try {
    const chartData = await chartController.updateChartData(chart.id, null, {});
    checkChartForAlerts(chartData);
    const dateUpdated = await updateDate(chart);
    if (!dateUpdated) {
      throw new Error(`Failed to update date for chart ${chart.id}`);
    }
    return true;
  } catch (error) {
    throw new Error(`Error running update for chart ${chart.id}: ${error.message}`);
  }
}

module.exports = async (job) => {
  try {
    const chart = job.data;
    const chartToUpdate = chart.dataValues ? chart.dataValues : chart;

    const dateUpdated = await updateDate(chartToUpdate);
    if (!dateUpdated) {
      throw new Error(`Failed to update date for chart ${chartToUpdate.id}`);
    }
    await runUpdate(chartToUpdate);
    return true;
  } catch (e) {
    throw new Error(e);
  }
};
