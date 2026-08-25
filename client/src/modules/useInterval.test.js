import assert from "node:assert/strict";
import test from "node:test";

import { startInterval } from "./useInterval.js";

test("interval does not start a second async callback while the first callback is pending", async () => {
  let callbackCount = 0;
  let releaseRequest;
  let tick;

  const stop = startInterval(() => {
    callbackCount += 1;
    return new Promise((resolve) => {
      releaseRequest = resolve;
    });
  }, 1000, {
    clearInterval: () => {},
    setInterval: (callback) => {
      tick = callback;
      return 1;
    },
  });

  tick();
  tick();
  assert.equal(callbackCount, 1);

  releaseRequest();
  await Promise.resolve();
  tick();
  assert.equal(callbackCount, 2);

  stop();
});

test("interval cleanup clears its timer", () => {
  let clearedId;
  const stop = startInterval(() => {}, 1000, {
    clearInterval: (id) => { clearedId = id; },
    setInterval: () => 42,
  });

  stop();
  assert.equal(clearedId, 42);
});

test("interval calls timer functions with their timer object", () => {
  const timers = {
    clearInterval() {
      assert.equal(this, timers);
    },
    setInterval() {
      assert.equal(this, timers);
      return 1;
    },
  };

  startInterval(() => {}, 1000, timers)();
});
