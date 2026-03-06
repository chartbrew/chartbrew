const cron = require("node-cron");
const moment = require("moment");
const { Op } = require("sequelize");
const path = require("path");
const { Worker } = require("bullmq");

const db = require("../models/models");

const CHART_WORKER_LOCK_DURATION_MS = parseInt(
  process.env.CB_QUEUE_LOCK_DURATION_MS,
  10
) || 900000;
const CHART_WORKER_LOCK_RENEW_TIME_MS = parseInt(
  process.env.CB_QUEUE_LOCK_RENEW_TIME_MS,
  10
) || 60000;

function buildJobId(entity, id) {
  return `${entity}_${id}_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

async function addChartsToQueue(charts, queue) {
  const addJobPromises = charts.map(async (chart) => {
    const chartToUpdate = chart.dataValues ? chart.dataValues : chart;
    await queue.add("updateChart", chartToUpdate, {
      jobId: buildJobId("chart", chartToUpdate.id),
      deduplication: {
        id: `chart_${chartToUpdate.id}`,
      },
    });
  });

  await Promise.all(addJobPromises);
}

async function updateCharts(queue) {
  const conditions = {
    where: {
      autoUpdate: { [Op.gt]: 0 },
      type: { [Op.not]: "markdown" },
    },
    attributes: ["id", "project_id", "name", "lastAutoUpdate", "autoUpdate", "chartData"],
    include: [{ model: db.ChartDatasetConfig }],
  };

  const charts = await db.Chart.findAll(conditions);
  if (!charts || charts.length === 0) {
    return;
  }

  const filteredCharts = charts.filter((chart) => moment(chart.lastAutoUpdate).add(chart.autoUpdate, "seconds").isBefore(moment()));
  if (filteredCharts.length === 0) {
    return;
  }

  await addChartsToQueue(filteredCharts, queue);
}

function createWorker(queue) {
  return new Worker(queue.name, async (job) => {
    const updateChartPath = path.join(__dirname, "workers", "updateChart.js");
    const updateChart = require(updateChartPath); // eslint-disable-line
    await updateChart(job);
  }, {
    connection: queue.opts.connection,
    concurrency: 5,
    lockDuration: CHART_WORKER_LOCK_DURATION_MS,
    lockRenewTime: Math.min(
      CHART_WORKER_LOCK_RENEW_TIME_MS,
      Math.floor(CHART_WORKER_LOCK_DURATION_MS / 2)
    ),
  });
}

module.exports = (queue) => {
  const worker = createWorker(queue);
  let isTickRunning = false;

  const runTick = async () => {
    if (isTickRunning) {
      return;
    }

    isTickRunning = true;
    try {
      await updateCharts(queue);
    } catch (error) {
      console.error(`Error updating charts: ${error.message}`); // eslint-disable-line
    } finally {
      isTickRunning = false;
    }
  };

  // run once initially to cover for server downtime
  runTick();

  // now run the cron job
  cron.schedule("*/1 * * * *", () => {
    runTick();
  });

  return worker;
};
