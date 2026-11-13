import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import * as toolkit from "@reduxjs/toolkit";

async function setup(fetch) {
  const context = vm.createContext({ Headers, URLSearchParams, fetch });
  const modules = {
    "../api/dashboardChartBatch": { requestDashboardChartBatch: async (url, options) => {
      const response = await fetch(url, options);
      if (response.status >= 400) throw new Error("Offline");
      return response.json();
    } },
    "../api/chartHistory": { saveChartChange: () => {} },
    "@reduxjs/toolkit": toolkit,
    "../modules/auth": { getAuthToken: () => "token" },
    "../config/settings": { API_HOST: "http://localhost" },
  };
  const source = await readFile(new URL("./chart.js", import.meta.url), "utf8");
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link((name) => new vm.SyntheticModule(Object.keys(modules[name]), function() {
    Object.entries(modules[name]).forEach(([key, value]) => this.setExport(key, value));
  }, { context }));
  await mod.evaluate();
  const store = toolkit.configureStore({ reducer: mod.namespace.default });
  store.dispatch(mod.namespace.setCharts([{ id: 1, initialDataPending: true }]));
  return { store, ...mod.namespace };
}

test("chart loading fails independently and can be retried", async () => {
  let response = { status: 500, json: async () => ({ message: "Offline" }) };
  const { store, getDashboardChartBatch } = await setup(async () => response);
  const args = { project_id: 1, charts: [{ chart_id: 1, filters: [], variables: {} }] };
  const request = store.dispatch(getDashboardChartBatch(args));
  assert.equal(store.getState().loading, false);
  assert.equal(store.getState().data[0].initialDataPending, true);
  await request;
  assert.equal(store.getState().data[0].initialDataPending, false);
  assert.equal(store.getState().data[0].initialDataError, true);
  response = { status: 200, json: async () => [{ id: 1, chart: { id: 1, render: { rows: [1] } } }] };
  await store.dispatch(getDashboardChartBatch(args));
  assert.equal(store.getState().data[0].initialDataError, false);
  assert.equal(store.getState().data[0].render.rows[0], 1);
});

test("navigation cancels fetch and old requests cannot replace new placeholders", async () => {
  let signal;
  const response = Promise.withResolvers();
  const { store, getDashboardChartBatch, setCharts } = await setup((url, options) => {
    signal = options.signal;
    return response.promise;
  });
  const request = store.dispatch(getDashboardChartBatch({ project_id: 1, charts: [{ chart_id: 1, filters: [], variables: {} }] }));
  store.dispatch(setCharts([{ id: 1, initialDataPending: true }]));
  request.abort();
  await request;
  assert.equal(signal.aborted, true);
  assert.equal(store.getState().data[0].initialDataPending, true);
  assert.equal(store.getState().data[0].initialDataError, undefined);
  response.resolve({ status: 200, json: async () => ({ id: 1, render: {} }) });
});


test("filtered batch results record their payload and ignore older responses", async () => {
  const pending = [];
  const { store, getDashboardChartBatch, shouldSkipFiltering } = await setup(() => {
    const deferred = Promise.withResolvers();
    pending.push(deferred);
    return deferred.promise;
  });
  const old = { chart_id: 1, filters: [], variables: { country: "US" } };
  const current = { chart_id: 1, filters: [], variables: { country: "GB" } };
  const first = store.dispatch(getDashboardChartBatch({ project_id: 1, charts: [old] }));
  const second = store.dispatch(getDashboardChartBatch({ project_id: 1, charts: [current] }));
  pending[1].resolve({ status: 200, json: async () => [{ id: 1, chart: { id: 1, render: { country: "GB" } } }] });
  await second;
  pending[0].resolve({ status: 200, json: async () => [{ id: 1, chart: { id: 1, render: { country: "US" } } }] });
  await first;
  const chart = store.getState().data[0];
  assert.equal(chart.render.country, "GB");
  assert.equal(shouldSkipFiltering(chart, current.filters, current.variables), true);
  assert.equal(shouldSkipFiltering(chart, old.filters, old.variables), false);
});


test("public batches send passwords in headers and preserve share credentials", async () => {
  const calls = [];
  const { store, getDashboardChartBatch } = await setup(async (url, options) => {
    calls.push({ url, options });
    return { status: 200, json: async () => [{ id: 1, chart: { id: 1, render: {} } }] };
  });
  const charts = [{ chart_id: 1, filters: [{ field: "country", operator: "is", value: "GB" }], variables: { currency: "GBP" } }];
  for (const report of [false, true]) {
    await store.dispatch(getDashboardChartBatch({ project_id: 7, charts, publicAccess: {
      brewName: "shared-dashboard", report, password: "secret", queryParams: { token: "share-token", tenant: "allowed", pass: "secret", password: "secret" },
    } }));
    const { url, options } = calls.at(-1);
    assert.equal(options.headers.pass, "secret");
    assert.equal(url.includes("secret"), false);
    assert.equal(url.includes(report ? "/shared-dashboard/report/charts" : "/dashboard/shared-dashboard/charts"), true);
    assert.equal(new URL(url).searchParams.get("token"), "share-token");
    assert.deepEqual(JSON.parse(options.body).charts, charts);
  }
  await store.dispatch(getDashboardChartBatch({ project_id: 7, charts, publicAccess: {
    brewName: "shared-dashboard", report: true, queryParams: { accessToken: "snapshot-token" },
  } }));
  assert.equal(calls.at(-1).url.includes("/dashboard/shared-dashboard/charts"), true);
});
