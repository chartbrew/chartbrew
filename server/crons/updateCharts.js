const cron = require("node-cron");
const moment = require("moment");
const { Op } = require("sequelize");
const path = require("path");
const { Worker } = require("bullmq");

const db = require("../models/models");

async function addChartsToQueue(charts, queue) {
  const addJobPromises = charts.map(async (chart) => {
    const chartToUpdate = chart.dataValues ? chart.dataValues : chart;
    const jobId = `chart_${chartToUpdate.id}`;
    await queue.add("updateChart", chartToUpdate, { jobId });
  });

  await Promise.all(addJobPromises);
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

async function checkActiveJobs(updateChartsQueue) {
  try {
    const activeJobs = await updateChartsQueue.getJobs(["active"]);

    const jobPromises = activeJobs.map(async (job) => {
      const jobTimestamp = moment(job.timestamp);
      const currentTime = moment();
      const duration = moment.duration(currentTime.diff(jobTimestamp));
      const minutes = duration.asMinutes();
      if (minutes > 5) {
        await job.moveToFailed({ message: "Job manually failed due to being stuck" });
        await job.remove();
      }
    });

    await Promise.all(jobPromises);
  } catch (err) {
    //
  }
}

function createWorker(queue) {
  return new Worker(queue.name, async (job) => {
    const updateChartPath = path.join(__dirname, "workers", "updateChart.js");
    const updateChart = require(updateChartPath); // eslint-disable-line
    await updateChart(job);
  }, { connection: queue.opts.connection, concurrency: 5 });
}

module.exports = (queue) => {
  createWorker(queue);

  // run once initially to cover for server downtime
  updateCharts(queue);
  checkActiveJobs(queue);

  // now run the cron job
  cron.schedule("*/1 * * * *", () => {
    updateCharts(queue);
    checkActiveJobs(queue);
  });

  return true;
};
