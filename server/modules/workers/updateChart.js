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
        return true;
      });
  }

  return new Promise((resolve) => resolve(true));
}

function runUpdate(chart) {
  return chartController.updateChartData(chart.id, null, {})
    .then(async (chartData) => {
      checkChartForAlerts(chartData);
      try {
        await updateDate(chart);
      } catch (err) {
        //
      }
      return true;
    })
    .catch(() => {
      return true;
    });
}

module.exports = async (job) => {
  const chart = job.data;
  const chartToUpdate = chart.dataValues ? chart.dataValues : chart;

  try {
    await updateDate(chartToUpdate);
    await runUpdate(chartToUpdate);
    return Promise.resolve(true);
  } catch (err) {
    return Promise.reject(err);
  }
};
