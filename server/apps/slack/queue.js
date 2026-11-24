const { Queue, Worker } = require("bullmq");
const { getQueueOptions } = require("../../redisConnection");

let queue;

function getSlackQueue() {
  if (!queue) queue = new Queue("slackRequests", getQueueOptions());
  return queue;
}

function startSlackWorker(processRequest) {
  const current = getSlackQueue();
  // shortcut: serialize Slack turns globally; use per-conversation locks when traffic requires concurrency.
  const ready = current.setGlobalConcurrency(1);
  const worker = new Worker(current.name, async ({ data }) => {
    await ready;
    await processRequest(data.requestId);
  }, { connection: getQueueOptions().connection, concurrency: 1, lockDuration: 900000 });
  worker.on("error", (error) => {
    console.error("Slack worker failed:", error.message); // oxlint-disable-line no-console
  });
  return { queue: current, worker };
}

module.exports = { getSlackQueue, startSlackWorker };
