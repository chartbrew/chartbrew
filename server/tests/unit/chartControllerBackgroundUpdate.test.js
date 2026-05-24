import {
  afterEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");

describe("ChartController background updates", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches a rejection handler to background chart updates after chart creation", async () => {
    const controller = new ChartController();
    const chart = {
      id: 123,
      name: "Revenue",
      project_id: 77,
    };

    vi.spyOn(db.Chart, "findAll").mockResolvedValue([]);
    vi.spyOn(db.Chart, "create").mockResolvedValue(chart);
    vi.spyOn(db.Dataset, "findAll").mockResolvedValue([{
      id: 456,
      name: "Revenue dataset",
    }]);
    vi.spyOn(db.ChartDatasetConfig, "create").mockResolvedValue({});
    vi.spyOn(db.Chart, "findOne").mockResolvedValue(chart);
    const catchSpy = vi.fn();
    const updateSpy = vi.spyOn(controller, "updateChartData").mockReturnValue({
      catch: catchSpy,
    });

    await expect(controller.createWithChartDatasetConfigs({
      project_id: 77,
      name: "Revenue",
      type: "line",
      chartDatasetConfigs: [{
        dataset_id: 456,
        xAxis: "root[].date",
        yAxis: "root[].amount",
      }],
    }, null)).resolves.toEqual(chart);

    expect(updateSpy).toHaveBeenCalledWith(123, null, {});
    expect(catchSpy).toHaveBeenCalledWith(expect.any(Function));
  });
});
