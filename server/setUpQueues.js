const { Queue, Worker } = require("bullmq");
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

let updateChartsQueue;
let updateDashboardsQueue;
let updateMongoDBSchemaQueue;

const setUpQueues = (app) => {
  // set up bullmq queues

  /*
  ** Update Charts Queue
  */
  updateChartsQueue = new Queue("updateChartsQueue", getQueueOptions());
  updateChartsQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the updates queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // eslint-disable-line no-console
      process.exit(1);
    }
  });

  /*
  ** Update Dashboards Queue
  */
  updateDashboardsQueue = new Queue("updateDashboardsQueue", getQueueOptions());
  updateDashboardsQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the updates queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // eslint-disable-line no-console
      process.exit(1);
    }
  });

  /*
  ** Update MongoDB Schema Queue
  */
  updateMongoDBSchemaQueue = new Queue("updateMongoDBSchemaQueue", getQueueOptions());
  updateMongoDBSchemaQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the MongoDB schema update queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // eslint-disable-line no-console
      process.exit(1);
    }
  });
  // create a worker for the updateMongoDBSchemaQueue
  const updateMongoDBSchemaWorker = new Worker(updateMongoDBSchemaQueue.name, async (job) => { // eslint-disable-line
    const updateMongoDBSchema = require("./crons/workers/updateMongoSchema"); // eslint-disable-line
    await updateMongoDBSchema(job);
  }, { connection: updateMongoDBSchemaQueue.opts.connection, concurrency: 1 });

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/apps/queues");

  createBullBoard({
    queues: [
      new BullMQAdapter(updateChartsQueue),
      new BullMQAdapter(updateDashboardsQueue),
      new BullMQAdapter(updateMongoDBSchemaQueue),
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
    await cleanActiveJobs(updateMongoDBSchemaQueue);
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Cleaning active jobs..."); // eslint-disable-line
    await cleanActiveJobs(updateChartsQueue);
    await cleanActiveJobs(updateDashboardsQueue);
    await cleanActiveJobs(updateMongoDBSchemaQueue);
    process.exit(0);
  });

  // Handle Nodemon reload
  process.on("SIGUSR2", async () => {
    console.log("SIGUSR2 received. Cleaning active jobs..."); // eslint-disable-line
    await cleanActiveJobs(updateChartsQueue);
    await cleanActiveJobs(updateDashboardsQueue);
    await cleanActiveJobs(updateMongoDBSchemaQueue);
    process.exit(0);
  });
};

module.exports = {
  setUpQueues,
  getQueues: () => ({
    updateChartsQueue,
    updateDashboardsQueue,
    updateMongoDBSchemaQueue,
  }),
};
