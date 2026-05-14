import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const updateDataset = require("../../modules/ai/orchestrator/tools/updateDataset");

describe("AI orchestrator updateDataset tool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.clientUrl = "https://app.chartbrew.test";
  });

  it("refreshes charts that use the updated dataset data request", async () => {
    const dataset = {
      id: 99,
      team_id: 7,
      main_dr_id: 1001,
      chart_id: null,
      name: "Team table",
    };
    const updatedDataset = {
      ...dataset,
      DataRequests: [{ id: 1001, query: "select member_count, dashboard_count from teams" }],
    };
    const chart = {
      id: 55,
      name: "Dashboards by Team",
      type: "table",
      project_id: 77,
      Project: {
        id: 77,
        name: "Temporary Preview",
        ghost: true,
      },
    };

    vi.spyOn(db.Dataset, "findByPk")
      .mockResolvedValueOnce(dataset)
      .mockResolvedValueOnce(updatedDataset);
    vi.spyOn(db.Dataset, "update").mockResolvedValue([0]);
    vi.spyOn(db.DataRequest, "findByPk").mockResolvedValue({
      id: 1001,
      dataset_id: 99,
    });
    vi.spyOn(db.DataRequest, "update").mockResolvedValue([1]);
    vi.spyOn(db.ChartDatasetConfig, "findAll").mockResolvedValue([{
      Chart: chart,
    }]);
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(chart);

    const result = await updateDataset({
      team_id: 7,
      dataset_id: 99,
      query: "select member_count, dashboard_count from teams",
    });

    expect(db.DataRequest.update).toHaveBeenCalledWith({
      query: "select member_count, dashboard_count from teams",
    }, { where: { id: 1001 } });
    expect(refreshSpy).toHaveBeenCalledWith(55, null, { getCache: false });
    expect(result).toMatchObject({
      dataset_id: 99,
      data_request_id: 1001,
      name: "Team table",
      chart_id: 55,
      chart_name: "Dashboards by Team",
      project_id: 77,
      is_temporary: true,
      visibility: "temporary",
      refreshed_chart_ids: [55],
    });
  });

  it("does not refresh chart data for dataset-only metadata changes", async () => {
    const dataset = {
      id: 99,
      team_id: 7,
      main_dr_id: 1001,
      chart_id: null,
      name: "Old name",
    };

    vi.spyOn(db.Dataset, "findByPk")
      .mockResolvedValueOnce(dataset)
      .mockResolvedValueOnce({ ...dataset, name: "New name" });
    vi.spyOn(db.Dataset, "update").mockResolvedValue([1]);
    vi.spyOn(db.DataRequest, "findByPk").mockResolvedValue({
      id: 1001,
      dataset_id: 99,
    });
    vi.spyOn(db.DataRequest, "update").mockResolvedValue([0]);
    vi.spyOn(db.ChartDatasetConfig, "findAll").mockResolvedValue([]);
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(null);

    const result = await updateDataset({
      team_id: 7,
      dataset_id: 99,
      name: "New name",
    });

    expect(db.DataRequest.update).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(result.updated_fields.dataset).toEqual(["name"]);
    expect(result.refreshed_chart_ids).toEqual([]);
  });
});
