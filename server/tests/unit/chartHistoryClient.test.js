import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../client/src/config/settings", () => ({ API_HOST: "http://test.local" }));
vi.mock("../../../client/src/modules/auth", () => ({ getAuthToken: () => "test-token" }));
const { saveChartChange } = await import("../../../client/src/api/chartHistory.js");

afterEach(() => vi.unstubAllGlobals());

describe("Chart history save requests", () => {
  it("orders quick saves and keeps the same operation when retrying a connection failure", async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError("Network error"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configurationVersion: 2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configurationVersion: 3 }) });
    vi.stubGlobal("fetch", fetch);
    const state = { chart: { data: [{ id: 1, configurationVersion: 0 }] } };
    const api = { getState: () => state, dispatch: vi.fn(), requestId: "first" };
    const args = { project_id: 1, chart_id: 1 };
    const first = saveChartChange(args, api, "", "PUT", { name: "First" });
    const second = saveChartChange(args, { ...api, requestId: "second" }, "", "PUT", { name: "Second" });
    await Promise.all([first, second]);
    const bodies = fetch.mock.calls.map(([, options]) => JSON.parse(options.body));
    expect(bodies).toEqual([
      { name: "First", expectedVersion: 0, operationId: "first" },
      { name: "First", expectedVersion: 0, operationId: "first" },
      { name: "Second", expectedVersion: 2, operationId: "second" },
    ]);
  });

  it("stops queued saves after a conflict without replacing the saved version", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ message: "Reload the latest chart." }) });
    vi.stubGlobal("fetch", fetch);
    const api = { getState: () => ({ chart: { data: [{ id: 2, configurationVersion: 1 }] } }), dispatch: vi.fn(), requestId: "conflict" };
    const args = { project_id: 1, chart_id: 2 };
    const results = await Promise.allSettled([
      saveChartChange(args, api, "", "PUT", { name: "Stale" }),
      saveChartChange(args, { ...api, requestId: "queued" }, "", "PUT", { name: "Queued" }),
    ]);
    expect(results.map((result) => result.reason.status)).toEqual([409, 409]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(api.dispatch).not.toHaveBeenCalled();
  });
});
