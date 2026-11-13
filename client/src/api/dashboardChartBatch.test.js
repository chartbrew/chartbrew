import assert from "node:assert/strict";
import test from "node:test";
import { requestDashboardChartBatch, retryAfterMilliseconds } from "./dashboardChartBatch.js";

test("Retry-After accepts seconds and HTTP dates", () => {
  assert.equal(retryAfterMilliseconds("2"), 2000);
  assert.equal(retryAfterMilliseconds("Thu, 01 Jan 1970 00:00:05 GMT", 1000), 4000);
  assert.equal(retryAfterMilliseconds("invalid"), 1000);
});

test("429 retries keep the same filtered body and stop after three attempts", async (t) => {
  const bodies = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    bodies.push(options.body);
    return { status: 429, headers: new Headers({ "Retry-After": "0" }) };
  });
  const body = JSON.stringify({ charts: [{ chart_id: 1, filters: [{ field: "country", value: "GB" }], variables: {} }] });
  await assert.rejects(requestDashboardChartBatch("/batch", { body, signal: new AbortController().signal }), /Too many requests/);
  assert.deepEqual(bodies, [body, body, body]);
});

test("rate-limit waiting can be cancelled before a retry", async (t) => {
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    setImmediate(() => controller.abort());
    return { status: 429, headers: new Headers({ "Retry-After": "0.01" }) };
  });
  await assert.rejects(requestDashboardChartBatch("/batch", { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("Retry-After pauses other batches and a successful retry returns data", async (t) => {
  const calls = [];
  const firstCall = Promise.withResolvers();
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      firstCall.resolve();
      return { status: 429, headers: new Headers({ "Retry-After": "0.1" }) };
    }
    return { status: 200, ok: true, json: async () => [url] };
  });
  const options = { signal: new AbortController().signal };
  const first = requestDashboardChartBatch("/first", options);
  await firstCall.promise;
  await new Promise((resolve) => setImmediate(resolve));
  const second = requestDashboardChartBatch("/second", options);
  await new Promise((resolve) => setImmediate(resolve));
  const countDuringPause = calls.length;
  assert.deepEqual(await Promise.all([first, second]), [["/first"], ["/second"]]);
  assert.equal(countDuringPause, 1);
  assert.equal(calls.length, 3);
});
