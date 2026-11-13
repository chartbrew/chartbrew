import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function setup() {
  const findAll = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
  const controller = {
    findById: vi.fn().mockResolvedValue({ id: 1, render: { cached: true } }),
    updateChartData: vi.fn().mockResolvedValue({ id: 2, render: { filtered: true } }),
  };
  const context = vm.createContext({
    module: { exports: {} },
    require: (name) => {
      if (name.includes("roles")) return { viewerRoles: ["projectViewer"] };
      if (name === "./runtimeCache") return { runSingleFlight: (key, callback) => callback() };
      return { Chart: { findAll } };
    },
  });
  vm.runInContext(readFileSync(new URL("../../modules/dashboardChartBatch.js", import.meta.url), "utf8"), context);
  return { load: context.module.exports.loadDashboardChartBatch, findAll, controller };
}

const user = { id: 5, teamRole: { role: "projectViewer" } };
const requests = [
  { chart_id: 1, filters: [], variables: {} },
  { chart_id: 2, filters: [{ field: "country", operator: "is", value: "GB" }], variables: { currency: "GBP" } },
];

describe("dashboard chart batches", () => {
  it("uses saved results and passes all active filters to the cache-first runtime once", async () => {
    const { load, findAll, controller } = setup();
    const results = await load(7, requests, user, controller);
    expect(results).toHaveLength(2);
    expect(findAll).toHaveBeenCalledWith({ attributes: ["id"], where: { id: [1, 2], project_id: 7, draft: false } });
    expect(controller.findById).toHaveBeenCalledExactlyOnceWith(1, null, { refreshPreparedData: false });
    expect(controller.updateChartData).toHaveBeenCalledExactlyOnceWith(2, user, {
      filters: requests[1].filters, variables: requests[1].variables,
      noSource: true, getCache: true, runtimeOnly: true,
    });
  });

  it("computes missing unfiltered results once while allowing source cache reads", async () => {
    const { load, findAll, controller } = setup();
    findAll.mockResolvedValue([{ id: 1 }]);
    controller.findById.mockResolvedValue({ id: 1, render: null, ChartDatasetConfigs: [{ id: 10 }] });
    await load(7, [requests[0]], user, controller);
    expect(controller.updateChartData).toHaveBeenCalledExactlyOnceWith(1, user, { noSource: false, getCache: true });
  });

  it("rejects missing, foreign, or hidden charts before loading any results", async () => {
    const { load, findAll, controller } = setup();
    findAll.mockResolvedValue([{ id: 1 }]);
    await expect(load(7, requests, user, controller)).rejects.toMatchObject({ status: 404 });
    expect(controller.findById).not.toHaveBeenCalled();
    expect(controller.updateChartData).not.toHaveBeenCalled();
  });

  it("rejects oversized batches, duplicate IDs, and malformed filters", async () => {
    const { load, findAll, controller } = setup();
    for (const invalid of [[], null, Array(5).fill(requests[0]), [requests[0], requests[0]], [{ ...requests[0], filters: [null] }], [{ ...requests[0], variables: [] }]]) {
      await expect(load(7, invalid, user, controller)).rejects.toMatchObject({ status: 400 });
    }
    expect(findAll).not.toHaveBeenCalled();
  });

  it("keeps successful charts when another chart fails and hides internal errors", async () => {
    const { load, controller } = setup();
    controller.updateChartData.mockRejectedValue(new Error("Secret connection details"));
    const results = await load(7, requests, user, controller);
    expect(results[0].chart.render.cached).toBe(true);
    expect(results[1]).toEqual({ id: 2, error: "Could not load this chart. Try again." });
  });
});
