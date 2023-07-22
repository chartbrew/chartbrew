const moment = require("moment");
const { workerData, parentPort } = require("worker_threads");

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

// configure the worker
const { charts } = workerData;
const updatePromises = [];
charts.forEach((chart) => {
  const chartToUpdate = chart.dataValues ? chart.dataValues : chart;

  updatePromises.push(
    updateDate(chartToUpdate).then(() => runUpdate(chartToUpdate))
  );
});

Promise.all(updatePromises)
  .then((results) => {
    parentPort.postMessage(results);
  })
  .catch((err) => {
    parentPort.postMessage(err);
  });
