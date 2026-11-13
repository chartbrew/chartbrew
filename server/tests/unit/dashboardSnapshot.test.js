import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

function loadSnapshots(page) {
  const browser = { newPage: async () => page, close: vi.fn() };
  const context = vm.createContext({
    module: { exports: {} },
    __dirname: "/server/modules",
    console: { log: vi.fn() },
    require: (name) => ({
      playwright: { chromium: { launch: async () => browser } },
      path,
      jsonwebtoken: { sign: () => "internal-token" },
      nanoid: { nanoid: () => "snapshot" },
      fs: { promises: { mkdir: vi.fn() } },
      "../../shared/reportAppearance.mjs": { resolveReportMode: () => "light" },
      uuid: { validate: () => true },
      "../settings": { client: "http://localhost", encryptionKey: "test" },
    })[name],
  });
  vm.runInContext(readFileSync(new URL("../../modules/snapshots.js", import.meta.url), "utf8"), context);
  return { ...context.module.exports, browser };
}

describe("dashboard image capture", () => {
  it.each([false, true])("waits for all chart data before full-page capture (report: %s)", async (report) => {
    let finishCharts;
    let reachedWait;
    const waiting = new Promise((resolve) => { reachedWait = resolve; });
    const chartsReady = new Promise((resolve) => { finishCharts = resolve; });
    const page = {
      setViewportSize: vi.fn(),
      goto: vi.fn(),
      waitForSelector: vi.fn(() => { reachedWait(); return chartsReady; }),
      waitForTimeout: vi.fn(),
      screenshot: vi.fn(),
    };
    const { snapDashboard } = loadSnapshots(page);
    const capture = snapDashboard({ id: 7, brewName: "sales", ...(report ? { reportAppearance: {} } : {}) });
    await waiting;
    expect(page.goto.mock.calls[0][0]).toContain(`/${report ? "report" : "b"}/sales?theme=light&accessToken=internal-token`);
    expect(page.waitForSelector).toHaveBeenCalledWith('div.dashboard-container[data-dashboard-loading="false"]', { state: "visible", timeout: 60000 });
    expect(page.screenshot).not.toHaveBeenCalled();
    finishCharts();
    expect(await capture).toBe("uploads/snapshots/snap-snapshot.png");
    expect(page.screenshot).toHaveBeenCalledWith(expect.objectContaining({ fullPage: true }));
  });

  it("does not capture an incomplete dashboard when loading times out", async () => {
    const page = {
      setViewportSize: vi.fn(), goto: vi.fn(),
      waitForSelector: vi.fn().mockRejectedValue(new Error("Timeout")),
      screenshot: vi.fn(),
    };
    const { snapDashboard, browser } = loadSnapshots(page);
    expect(await snapDashboard({ id: 7, brewName: "sales" })).toBeNull();
    expect(page.screenshot).not.toHaveBeenCalled();
    expect(browser.close).toHaveBeenCalledOnce();
  });
});
