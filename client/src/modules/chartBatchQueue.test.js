import assert from "node:assert/strict";
import test from "node:test";
import { createChartBatchQueue } from "./chartBatchQueue.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("only visible charts enter batches of four with at most two batches in flight", async () => {
  const batches = [];
  const requests = Array.from({ length: 20 }, (_, index) => ({ chart_id: index + 1 }));
  const queue = createChartBatchQueue({
    requests,
    isLoaded: ({ chart_id }) => chart_id === 2,
    loadBatch: (items) => {
      const deferred = Promise.withResolvers();
      const request = Object.assign(deferred.promise, { abort: () => deferred.reject(new Error("Aborted")) });
      batches.push({ items, ...deferred });
      return request;
    },
  });
  for (let id = 1; id <= 12; id += 1) queue.enqueue(id);
  queue.enqueue(1);
  await flush();
  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0].items.map(({ chart_id }) => chart_id), [1, 3, 4, 5]);
  assert.equal(batches[1].items.length, 4);
  batches[0].reject(new Error("Offline"));
  await flush();
  assert.equal(batches.length, 3);
  assert.deepEqual(batches[2].items.map(({ chart_id }) => chart_id), [10, 11, 12]);
  queue.enqueue(1);
  await flush();
  assert.equal(batches.length, 3);
  queue.retry(1);
  batches[1].resolve([]);
  await flush();
  assert.equal(batches[3].items[0].chart_id, 1);
  queue.stop();
  await flush();
  queue.enqueue(20);
  await flush();
  assert.equal(batches.length, 4);
});
