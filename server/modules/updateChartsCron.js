const cron = require("node-cron");
const moment = require("moment");
const { Op } = require("sequelize");
const { Worker } = require("worker_threads");
const path = require("path");

const db = require("../models/models");

function assignChartsPerWorker(charts) {
  const workers = [];
  const workerCount = process.env.CB_BACKEND_WORKERS || 4;
  const chartsPerWorker = Math.ceil(charts.length / workerCount);

  for (let i = 0; i < workerCount; i++) {
    let workerCharts = charts.slice(i * chartsPerWorker, (i + 1) * chartsPerWorker);
    // transform the data to json
    workerCharts = workerCharts.map((chart) => chart.toJSON());

    const workerPath = path.join(__dirname, "/workers/updateChart.js");
    workers.push(new Worker(workerPath, { workerData: { charts: workerCharts } }));
  }

  /** TO ACTIVATE FOR DEBUGGING */
  // workers.forEach((worker) => {
  //   worker.on("message", (message) => {
  //     console.log("worker message", message);
  //   });
  //   worker.on("error", (error) => {
  //     console.log("worker error", error);
  //   });
  //   worker.on("exit", (code) => {
  //     console.log("worker exit code", code);
  //   });
  // });

  return Promise.all(workers);
}

function updateCharts() {
  const conditions = {
    where: {
      autoUpdate: { [Op.gt]: 0 }
    },
    attributes: ["id", "project_id", "name", "lastAutoUpdate", "autoUpdate", "chartData"],
    include: [{ model: db.Dataset }],
  };

  return db.Chart.findAll(conditions)
    .then((charts) => {
      if (!charts || charts.length === 0) {
        return new Promise((resolve) => resolve({ completed: true }));
      }

      const filteredCharts = charts.filter((chart) => moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment()));

      // throttleUpdateDates(filteredCharts, 0);
      // throttleUpdates(filteredCharts, 0);
      assignChartsPerWorker(filteredCharts);

      return { completed: true };
    })
    .catch((error) => {
      return new Promise((resolve, reject) => reject(error));
    });
}

module.exports = () => {
  // run once initially to cover for server downtime
  updateCharts();

  // now run the cron job
  cron.schedule("*/1 * * * *", () => {
    updateCharts();
  });

  return true;
};
