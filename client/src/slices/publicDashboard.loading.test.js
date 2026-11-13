import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import * as toolkit from "@reduxjs/toolkit";

async function setup(fetch) {
  const context = vm.createContext({ Headers, URLSearchParams, fetch });
  const modules = {
    "@reduxjs/toolkit": toolkit,
    "../modules/auth": { getAuthToken: () => null },
    "../config/settings": { API_HOST: "https://charts.example" },
    "./chart": { setCharts: (payload) => ({ type: "charts", payload }) },
  };
  const mod = new vm.SourceTextModule(await readFile(new URL("./project.js", import.meta.url), "utf8"), { context });
  await mod.link((name) => new vm.SyntheticModule(Object.keys(modules[name]), function() {
    Object.entries(modules[name]).forEach(([key, value]) => this.setExport(key, value));
  }, { context }));
  await mod.evaluate();
  return mod.namespace;
}

for (const name of ["getPublicDashboard", "getReport"]) {
  test(`${name} loads configuration with password headers and chart placeholders`, async () => {
    const calls = [];
    const actions = [];
    const module = await setup(async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ id: 7, Charts: [{ id: 1, type: "line" }, { id: 2, type: "markdown" }] }) };
    });
    await module[name]({ brewName: "shared", password: "secret", token: "token", queryParams: { pass: "secret" }, configurationOnly: true })(
      (action) => actions.push(action), () => ({}), {},
    );
    assert.equal(new URL(calls[0].url).searchParams.get("view"), "configuration");
    assert.equal(calls[0].url.includes("secret"), false);
    assert.equal(calls[0].options.headers.get("pass"), "secret");
    assert.deepEqual(Array.from(actions.find((action) => action.type === "charts").payload, (chart) => chart.initialDataPending), [true, false]);
  });

  test(`${name} cannot replace charts after its request is cancelled`, async () => {
    const deferred = Promise.withResolvers();
    const actions = [];
    const module = await setup(() => deferred.promise);
    const task = module[name]({ brewName: "shared", configurationOnly: true })((action) => actions.push(action), () => ({}), {});
    task.abort();
    await task;
    deferred.resolve({ ok: true, json: async () => ({ id: 7, Charts: [{ id: 1 }] }) });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(actions.some((action) => action.type === "charts"), false);
  });
}
