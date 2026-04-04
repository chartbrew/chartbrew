const { Queue, Worker, QueueEvents } = require("bullmq");
const { createBullBoard } = require("@bull-board/api");
const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
const { ExpressAdapter } = require("@bull-board/express");

const { getQueueOptions } = require("./redisConnection");
const updateCharts = require("./crons/updateCharts");
const updateDashboards = require("./crons/updateDashboards");
const sendSnapshots = require("./crons/sendSnapshots");
// const updateSnapshots = require("./crons/updateSnapshots");

const WORKER_LOCK_DURATION_MS = parseInt(process.env.CB_QUEUE_LOCK_DURATION_MS, 10) || 900000;
const WORKER_LOCK_RENEW_TIME_MS = parseInt(process.env.CB_QUEUE_LOCK_RENEW_TIME_MS, 10) || 60000;
const EFFECTIVE_WORKER_LOCK_RENEW_TIME_MS = Math.min(
  WORKER_LOCK_RENEW_TIME_MS,
  Math.floor(WORKER_LOCK_DURATION_MS / 2)
);
const isQueueDebugEnabled = /^(1|true|yes|on)$/i.test(`${process.env.CB_QUEUE_DEBUG || ""}`);

function debugQueueLog(queueName, eventName, payload = null) {
  if (!isQueueDebugEnabled) {
    return;
  }

  if (payload) {
    console.log(`[queue:${queueName}] ${eventName}`, payload); // oxlint-disable-line no-console
    return;
  }

  console.log(`[queue:${queueName}] ${eventName}`); // oxlint-disable-line no-console
}

let updateChartsQueue;
let updateDashboardsQueue;
let updateMongoDBSchemaQueue;

const setUpQueues = (app) => {
  const queuesToClose = [];
  const workersToClose = [];
  const queueEventsToClose = [];

  if (isQueueDebugEnabled) {
    console.log("[setUpQueues] queue debug logging is ENABLED"); // oxlint-disable-line no-console
  }

  // set up bullmq queues

  /*
  ** Update Charts Queue
  */
  updateChartsQueue = new Queue("updateChartsQueue", getQueueOptions());
  queuesToClose.push(updateChartsQueue);
  updateChartsQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the updates queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // oxlint-disable-line no-console
      process.exit(1);
    }
  });

  /*
  ** Update Dashboards Queue
  */
  updateDashboardsQueue = new Queue("updateDashboardsQueue", getQueueOptions());
  queuesToClose.push(updateDashboardsQueue);
  updateDashboardsQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the updates queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // oxlint-disable-line no-console
      process.exit(1);
    }
  });

  const updateDashboardsQueueEvents = new QueueEvents(updateDashboardsQueue.name, {
    connection: updateDashboardsQueue.opts.connection,
  });
  queueEventsToClose.push(updateDashboardsQueueEvents);

  if (isQueueDebugEnabled) {
    updateDashboardsQueueEvents.on("waiting", (event) => {
      debugQueueLog(updateDashboardsQueue.name, "waiting", event);
    });
    updateDashboardsQueueEvents.on("active", (event) => {
      debugQueueLog(updateDashboardsQueue.name, "active", event);
    });
    updateDashboardsQueueEvents.on("completed", (event) => {
      debugQueueLog(updateDashboardsQueue.name, "completed", event);
    });
    updateDashboardsQueueEvents.on("failed", (event) => {
      debugQueueLog(updateDashboardsQueue.name, "failed", event);
    });
    updateDashboardsQueueEvents.on("stalled", (event) => {
      debugQueueLog(updateDashboardsQueue.name, "stalled", event);
    });
    updateDashboardsQueueEvents.on("deduplicated", (event) => {
      debugQueueLog(updateDashboardsQueue.name, "deduplicated", event);
    });
    updateDashboardsQueueEvents.on("error", (error) => {
      debugQueueLog(updateDashboardsQueue.name, "error", { message: error.message });
    });
  }

  /*
  ** Update MongoDB Schema Queue
  */
  updateMongoDBSchemaQueue = new Queue("updateMongoDBSchemaQueue", getQueueOptions());
  queuesToClose.push(updateMongoDBSchemaQueue);
  updateMongoDBSchemaQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the MongoDB schema update queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // oxlint-disable-line no-console
      process.exit(1);
    }
  });
  // create a worker for the updateMongoDBSchemaQueue
  const updateMongoDBSchemaWorker = new Worker(updateMongoDBSchemaQueue.name, async (job) => { // eslint-disable-line
    const updateMongoDBSchema = require("./crons/workers/updateMongoSchema"); // eslint-disable-line
    await updateMongoDBSchema(job);
  }, {
    connection: updateMongoDBSchemaQueue.opts.connection,
    concurrency: 1,
    lockDuration: WORKER_LOCK_DURATION_MS,
    lockRenewTime: EFFECTIVE_WORKER_LOCK_RENEW_TIME_MS,
  });
  workersToClose.push(updateMongoDBSchemaWorker);

  /*
  ** Dashboard Snapshot Queue
  */
  const dashboardSnapshotQueue = new Queue("sendSnapshotsQueue", getQueueOptions());
  queuesToClose.push(dashboardSnapshotQueue);
  dashboardSnapshotQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the dashboard snapshot queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // oxlint-disable-line no-console
      process.exit(1);
    }
  });
  // create a worker for the dashboardSnapshotQueue
  const sendSnapshotWorker = new Worker(dashboardSnapshotQueue.name, async (job) => { // eslint-disable-line
    const sendSnapshot = require("./crons/workers/sendSnapshot"); // eslint-disable-line
    await sendSnapshot(job);
  }, {
    connection: dashboardSnapshotQueue.opts.connection,
    concurrency: 1,
    lockDuration: WORKER_LOCK_DURATION_MS,
    lockRenewTime: EFFECTIVE_WORKER_LOCK_RENEW_TIME_MS,
  });
  workersToClose.push(sendSnapshotWorker);

  /*
  ** Update Snapshots Queue
  */
  const updateSnapshotsQueue = new Queue("updateSnapshotsQueue", getQueueOptions());
  queuesToClose.push(updateSnapshotsQueue);
  updateSnapshotsQueue.on("error", (error) => {
    if (error.code === "ECONNREFUSED") {
      console.error("Failed to set up the update snapshots queue. Please check if Redis is running: https://docs.chartbrew.com/quickstart#set-up-redis-for-automatic-dataset-updates"); // oxlint-disable-line no-console
      process.exit(1);
    }
  });
  // create a worker for the updateSnapshotsQueue
  const takeSnapshotWorker = new Worker(updateSnapshotsQueue.name, async (job) => { // eslint-disable-line
    const takeSnapshot = require("./crons/workers/takeSnapshot"); // eslint-disable-line
    await takeSnapshot(job);
  }, {
    connection: updateSnapshotsQueue.opts.connection,
    concurrency: 10,
    lockDuration: WORKER_LOCK_DURATION_MS,
    lockRenewTime: EFFECTIVE_WORKER_LOCK_RENEW_TIME_MS,
  });
  workersToClose.push(takeSnapshotWorker);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/apps/queues");

  createBullBoard({
    queues: [
      new BullMQAdapter(updateChartsQueue),
      new BullMQAdapter(updateDashboardsQueue),
      new BullMQAdapter(updateMongoDBSchemaQueue),
      new BullMQAdapter(dashboardSnapshotQueue),
      new BullMQAdapter(updateSnapshotsQueue),
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
  const updateChartsWorker = updateCharts(updateChartsQueue);
  const updateDashboardsWorker = updateDashboards(updateDashboardsQueue);
  workersToClose.push(updateChartsWorker, updateDashboardsWorker);
  sendSnapshots(dashboardSnapshotQueue);

  // Uncomment this to enable regular snapshot updates
  // updateSnapshots(updateSnapshotsQueue);

  let isShuttingDown = false;
  const closeQueuesAndWorkers = async (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`${signal} received. Closing BullMQ workers and queues...`); // eslint-disable-line

    const workerResults = await Promise.allSettled(workersToClose.map((worker) => worker.close()));
    workerResults
      .filter((result) => result.status === "rejected")
      .forEach((result) => {
        console.error(`Failed to close worker: ${result.reason?.message || result.reason}`); // eslint-disable-line
      });

    const queueResults = await Promise.allSettled(queuesToClose.map((queue) => queue.close()));
    queueResults
      .filter((result) => result.status === "rejected")
      .forEach((result) => {
        console.error(`Failed to close queue: ${result.reason?.message || result.reason}`); // eslint-disable-line
      });

    const queueEventResults = await Promise.allSettled(
      queueEventsToClose.map((queueEvents) => queueEvents.close())
    );
    queueEventResults
      .filter((result) => result.status === "rejected")
      .forEach((result) => {
        console.error(`Failed to close queue events: ${result.reason?.message || result.reason}`); // eslint-disable-line
      });

    process.exit(0);
  };

  ["SIGINT", "SIGTERM", "SIGUSR2"].forEach((signal) => {
    process.on(signal, () => {
      closeQueuesAndWorkers(signal);
    });
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
