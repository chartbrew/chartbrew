import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { buildChartRuntimeRequest } from "../../../modules/chartRuntimeFilters.js";
import { createChartBatchQueue } from "../../../modules/chartBatchQueue.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));

for (const loadAll of [false, true]) {
test(`${loadAll ? "snapshot" : "visibility"} batches use active filters once and cancel when filters change`, async () => {
  const refs = [];
  let cursor = 0;
  const effects = [];
  const cleanup = () => effects.forEach((effect) => effect?.cleanup?.());
  const batches = [];
  const observers = [];
  const charts = [{ id: 1, project_id: 7, type: "bar", onReport: true }, { id: 2, project_id: 7, type: "line", onReport: true }];
  const dispatch = (args) => {
    const deferred = Promise.withResolvers();
    const result = Object.assign(deferred.promise, { abort: () => { result.aborted = true; deferred.resolve(); } });
    batches.push({ args, result });
    return result;
  };
  const store = { getState: () => ({ chart: { data: charts } }) };
  const modules = {
    react: {
      useRef: (value) => { const index = cursor++; return refs[index] ||= { current: value }; },
      useCallback: (callback) => callback,
      useEffect: (callback, next) => {
        const index = cursor++;
        const previous = effects[index];
        if (!previous || next.some((value, key) => value !== previous.deps[key])) {
          effects[index] = { deps: next, pending: callback, cleanup: previous?.cleanup };
        }
      },
    },
    "react-redux": { useDispatch: () => dispatch, useStore: () => store },
    "../../../slices/chart": { getDashboardChartBatch: (args) => args, shouldSkipFiltering: () => false },
    "../../../modules/chartRuntimeFilters": { buildChartRuntimeRequest },
    "../../../modules/chartBatchQueue": { createChartBatchQueue },
  };
  const context = vm.createContext({
    window: { innerHeight: 800 },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      unobserve() {}
      disconnect() { this.disconnected = true; }
    },
  });
  const source = await readFile(new URL("./useDashboardChartData.js", import.meta.url), "utf8");
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link((name) => new vm.SyntheticModule(Object.keys(modules[name]), function() {
    Object.entries(modules[name]).forEach(([key, value]) => this.setExport(key, value));
  }, { context }));
  await mod.evaluate();
  const render = (country) => {
    cursor = 0;
    const hook = mod.namespace.default({ projectId: 7, charts, loadAll,
      publicAccess: loadAll ? { brewName: "report", report: true, password: "secret", queryParams: { accessToken: "snapshot" } } : undefined,
      dashboardFilters: [{ type: "variable", variable: "country", value: country }],
      chartFilters: { 1: [{ cdcId: 10, field: "status", operator: "is", value: "active" }] },
    });
    effects.forEach((effect) => {
      if (effect?.pending) {
        effect.cleanup?.();
        effect.cleanup = effect.pending();
        effect.pending = null;
      }
    });
    return hook;
  };
  const widget = { dataset: { chartId: "1" } };
  render("GB").observeChart(widget);
  await flush();
  assert.equal(batches.length, loadAll ? 1 : 0);
  observers[0].callback([{ target: widget, isIntersecting: true, boundingClientRect: { top: 0 } }]);
  await flush();
  assert.equal(batches.length, 1);
  assert.equal(batches[0].args.charts.length, loadAll ? 2 : 1);
  if (loadAll) assert.equal(batches[0].args.publicAccess.password, "secret");
  assert.equal(batches[0].args.charts[0].variables.country, "GB");
  assert.equal(batches[0].args.charts[0].filters[0].cdcId, 10);
  render("GB");
  observers[0].callback([{ target: widget, isIntersecting: true, boundingClientRect: { top: 0 } }]);
  await flush();
  assert.equal(batches.length, 1);
  render("US");
  assert.equal(batches[0].result.aborted, true);
  assert.equal(observers[0].disconnected, true);
  observers[1].callback([{ target: widget, isIntersecting: true, boundingClientRect: { top: 0 } }]);
  await flush();
  assert.equal(batches[1].args.charts[0].variables.country, "US");
  cleanup();
});

}
