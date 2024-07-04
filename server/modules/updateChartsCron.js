const cron = require("node-cron");
const moment = require("moment");
const { Op } = require("sequelize");
const path = require("path");

const db = require("../models/models");

function addChartsToQueue(charts, queue) {
  charts.forEach((chart) => {
    const chartToUpdate = chart.dataValues ? chart.dataValues : chart;
    const jobId = `chart_${chartToUpdate.id}`;
    queue.add("updateChart", chartToUpdate, { jobId });
  });
}

function updateCharts(queue) {
  const conditions = {
    where: {
      autoUpdate: { [Op.gt]: 0 }
    },
    attributes: ["id", "project_id", "name", "lastAutoUpdate", "autoUpdate", "chartData"],
    include: [{ model: db.ChartDatasetConfig }],
  };

  return db.Chart.findAll(conditions)
    .then((charts) => {
      if (!charts || charts.length === 0) {
        return new Promise((resolve) => resolve({ completed: true }));
      }

      const filteredCharts = charts.filter((chart) => moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment()));

      addChartsToQueue(filteredCharts, queue);

      return { completed: true };
    })
    .catch((error) => {
      return new Promise((resolve, reject) => reject(error));
    });
}

module.exports = (queue) => {
  queue.process("updateChart", 5, path.join(__dirname, "workers", "updateChart.js"));
  // run once initially to cover for server downtime
  updateCharts(queue);

  // now run the cron job
  cron.schedule("*/1 * * * *", () => {
    updateCharts(queue);
  });

  return true;
};
