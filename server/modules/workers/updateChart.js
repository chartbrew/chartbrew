const moment = require("moment");
const { workerData, parentPort } = require("worker_threads");

const ChartController = require("../../controllers/ChartController");

const chartController = new ChartController();

function runUpdate(chart) {
  return chartController.updateChartData(chart.id, null, {})
    .then(() => {
      return true;
    })
    .catch(() => {
      return true;
    });
}

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

// configure the worker
const { charts } = workerData;
const updatePromises = [];
charts.forEach((chart) => {
  const chartToUpdate = chart.dataValues ? chart.dataValues : chart;

  updatePromises.push(
    updateDate(chartToUpdate).then(() => runUpdate(chartToUpdate))
  );
});

return Promise.all(updatePromises)
  .then((results) => {
    parentPort.postMessage(results);
  })
  .catch((err) => {
    parentPort.postMessage(err);
  });
