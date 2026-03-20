import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const snapshotsPath = require.resolve("../../modules/snapshots.js");
const chartControllerPath = require.resolve("../../controllers/ChartController.js");

function loadChartControllerWithSnapChart(snapChartImplementation) {
  const snapshotsModule = require(snapshotsPath);
  const originalSnapChart = snapshotsModule.snapChart;

  snapshotsModule.snapChart = snapChartImplementation;
  delete require.cache[chartControllerPath];

  const ChartController = require(chartControllerPath);

  return {
    ChartController,
    restore() {
      snapshotsModule.snapChart = originalSnapChart;
      delete require.cache[chartControllerPath];
    },
  };
}

describe("ChartController snapshot parity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete require.cache[chartControllerPath];
  });

  it("delegates V2 chart snapshots to snapChart using the chart snapshot token", async () => {
    const snapChart = vi.fn().mockResolvedValue("uploads/snapshots/snap-v2.png");
    const loader = loadChartControllerWithSnapChart(snapChart);
    const controller = new loader.ChartController();

    vi.spyOn(controller, "findById").mockResolvedValue({
      id: 412,
      type: "bar",
      snapshotToken: "snapshot-v2-token",
      ChartDatasetConfigs: [{
        id: "cdc_snapshot_v2",
        vizVersion: 2,
        vizConfig: {
          version: 2,
        },
      }],
    });

    await expect(controller.takeSnapshot(412)).resolves.toBe("uploads/snapshots/snap-v2.png");
    expect(controller.findById).toHaveBeenCalledWith(412);
    expect(snapChart).toHaveBeenCalledWith("snapshot-v2-token");

    loader.restore();
  });

  it("rejects snapshot requests when the chart does not have a snapshot token", async () => {
    const snapChart = vi.fn();
    const loader = loadChartControllerWithSnapChart(snapChart);
    const controller = new loader.ChartController();

    vi.spyOn(controller, "findById").mockResolvedValue({
      id: 413,
      type: "line",
      ChartDatasetConfigs: [{
        id: "cdc_snapshot_missing",
        vizVersion: 2,
        vizConfig: {
          version: 2,
        },
      }],
    });

    await expect(controller.takeSnapshot(413)).rejects.toBe("Chart does not have a snapshot token");
    expect(snapChart).not.toHaveBeenCalled();

    loader.restore();
  });
});
