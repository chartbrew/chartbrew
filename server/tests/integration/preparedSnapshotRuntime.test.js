import {
  beforeAll, beforeEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);

describe("Prepared snapshot runtime", () => {
  let ChartController;
  let models;
  let runtimeCache;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    models = await getModels();
    ChartController = require("../../controllers/ChartController.js");
    runtimeCache = require("../../modules/runtimeCache.js");
  });

  beforeEach(async () => {
    await models.sequelize.sync({ force: true });
    await runtimeCache.resetForTests();
  });

  it("stores PreparedData and recompiles Chart.js after runtime caches are empty", async () => {
    const team = await models.Team.create({ name: "Prepared Team" });
    const project = await models.Project.create({
      brewName: "prepared-project",
      ghost: false,
      name: "Prepared Project",
      team_id: team.id,
      timezone: "UTC",
    });
    const chart = await models.Chart.create({
      draft: false,
      name: "Prepared Chart",
      project_id: project.id,
      type: "bar",
    });
    const dataset = await models.Dataset.create({
      conditions: [],
      draft: false,
      fieldsSchema: {
        "root[].count": "number",
        "root[].month": "string",
      },
      legend: "Orders",
      name: "Orders",
      project_ids: [project.id],
      team_id: team.id,
      xAxis: "root[].month",
      yAxis: "root[].count",
      yAxisOperation: "none",
    });
    await models.ChartDatasetConfig.create({
      chart_id: chart.id,
      conditions: [],
      dataset_id: dataset.id,
      legend: "Orders",
      xAxis: "root[].month",
      yAxis: "root[].count",
      yAxisOperation: "none",
    });

    const controller = new ChartController();
    const requestSpy = vi.spyOn(controller.datasetController, "runRequest")
      .mockResolvedValue({
        data: [{ count: 10, month: "Jan" }, { count: 20, month: "Feb" }],
        options: dataset.toJSON(),
      });
    const refreshed = await controller.updateChartData(chart.id, null, {
      getCache: false,
      noSource: false,
    });
    requestSpy.mockRestore();

    expect(refreshed.chartData).toBe(refreshed.render.configuration);
    expect(refreshed.render).toMatchObject({ renderer: "chartjs", stale: false, version: 1 });

    const stored = await models.Chart.unscoped().findByPk(chart.id);
    expect(stored.preparedData).toMatchObject({ version: 1 });
    expect(stored.preparedDataFingerprint).toHaveLength(64);
    expect(stored.chartData).toBeNull();

    const ordinary = await models.Chart.findByPk(chart.id);
    expect(ordinary.toJSON()).not.toHaveProperty("preparedData");

    await runtimeCache.resetForTests();
    const coldController = new ChartController();
    const coldRequestSpy = vi.spyOn(coldController.datasetController, "runRequest")
      .mockRejectedValue(new Error("Source must not run"));
    const coldRead = await coldController.findById(chart.id);

    expect(coldRead.chartData.data.labels).toEqual(["Jan", "Feb"]);
    expect(coldRead.render.stale).toBe(false);
    expect(coldRequestSpy).not.toHaveBeenCalled();

    await dataset.update({
      fieldsSchema: {
        "root[].count": "number",
        "root[].month": "string",
        "root[].status": "string",
      },
    });
    coldRequestSpy.mockResolvedValue({
      data: [{ count: 10, month: "Jan" }, { count: 20, month: "Feb" }],
      options: dataset.toJSON(),
    });
    const staleRead = await coldController.findById(chart.id, null, {
      refreshPreparedData: true,
    });
    expect(staleRead.render.stale).toBe(true);
    await runtimeCache.runSingleFlight(
      `prepared-snapshot-refresh:${chart.id}`,
      async () => null
    );
    expect(coldRequestSpy).toHaveBeenCalled();
    coldRequestSpy.mockRestore();
  });
});
