const moment = require("moment");
const ChartController = require("../../controllers/ChartController");
const { checkChartForAlerts } = require("../alerts/checkAlerts");

const chartController = new ChartController();

function updateDate(chart) {
  if (moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment())) {
    return chartController.update(chart.id, { lastAutoUpdate: moment() })
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  }

  return new Promise((resolve) => resolve(true));
}

function runUpdate(chart) {
  return chartController.updateChartData(chart.id, null, {})
    .then(async (chartData) => {
      checkChartForAlerts(chartData);
      const dateUpdated = await updateDate(chart);
      if (!dateUpdated) {
        throw new Error(`Failed to update date for chart ${chart.id}`);
      }
      return true;
    })
    .catch((err) => {
      throw err;
    });
}

module.exports = async (job) => {
  const chart = job.data;
  const chartToUpdate = chart.dataValues ? chart.dataValues : chart;

  try {
    const dateUpdated = await updateDate(chartToUpdate);
    if (!dateUpdated) {
      throw new Error(`Failed to update date for chart ${chartToUpdate.id}`);
    }
    await runUpdate(chartToUpdate);
    return Promise.resolve(true);
  } catch (err) {
    return Promise.reject(err);
  }
};
