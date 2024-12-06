const { Queue } = require("bullmq");
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");

const { getQueueOptions } = require("./redisConnection");
const updateCharts = require("./crons/updateCharts");
const updateDashboards = require("./crons/updateDashboards");

async function cleanActiveJobs(queue) {
  try {
    const activeJobs = await queue.getJobs(["active"]);

    const jobPromises = activeJobs.map(async (job) => {
      await job.moveToFailed({ message: "Job manually failed due to server restart" });
      await job.remove();
    });

    await Promise.all(jobPromises);

    console.log(`Cleaned ${activeJobs.length} active jobs.`); // eslint-disable-line
  } catch (err) {
    console.error(`Failed to clean active jobs: ${err.message}`); // eslint-disable-line
  }
}

module.exports = (app) => {
  // set up bullmq queues
  const updateChartsQueue = new Queue("updateChartsQueue", getQueueOptions());
  updateChartsQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the updates queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // eslint-disable-line no-console
      process.exit(1);
    }
  });

  const updateDashboardsQueue = new Queue("updateDashboardsQueue", getQueueOptions());
  updateDashboardsQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the updates queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // eslint-disable-line no-console
      process.exit(1);
    }
  });

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/apps/queues");

  createBullBoard({
    queues: [
      new BullMQAdapter(updateChartsQueue),
      new BullMQAdapter(updateDashboardsQueue),
    ],
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: "Chartbrew Jobs",
      },
    },
  });

  app.use("/apps/queues", (req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; img-src *;"); // Allow images to load from any source
    next();
  }, serverAdapter.getRouter());

  // set up cron jobs
  updateCharts(updateChartsQueue);
  updateDashboards(updateDashboardsQueue);

  // Handle PM2 shutdown/reload
  process.on("SIGINT", async () => {
    console.log("SIGINT received. Cleaning active jobs..."); // eslint-disable-line
    await cleanActiveJobs(updateChartsQueue);
    await cleanActiveJobs(updateDashboardsQueue);
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Cleaning active jobs..."); // eslint-disable-line
    await cleanActiveJobs(updateChartsQueue);
    await cleanActiveJobs(updateDashboardsQueue);
    process.exit(0);
  });

  // Handle Nodemon reload
  process.on("SIGUSR2", async () => {
    console.log("SIGUSR2 received. Cleaning active jobs..."); // eslint-disable-line
    await cleanActiveJobs(updateChartsQueue);
    await cleanActiveJobs(updateDashboardsQueue);
    process.exit(0);
  });
};
