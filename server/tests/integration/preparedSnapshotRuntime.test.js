import {
  beforeAll, beforeEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);

describe("Prepared snapshot runtime", () => {
  let ChartController;
  let DatasetController;
  let ProjectController;
  let models;
  let runtimeCache;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    models = await getModels();
    ChartController = require("../../controllers/ChartController.js");
    DatasetController = require("../../controllers/DatasetController.js");
    ProjectController = require("../../controllers/ProjectController.js");
    runtimeCache = require("../../modules/runtimeCache.js");
  });

  beforeEach(async () => {
    await models.sequelize.sync({ force: true });
    await runtimeCache.resetForTests();
  });

  it("automatically prepares old dashboard charts and compiles them after caches are empty", async () => {
    const team = await models.Team.create({ name: "Prepared Team" });
    const project = await models.Project.create({
      brewName: "prepared-project",
      ghost: false,
      name: "Prepared Project",
      team_id: team.id,
      timezone: "UTC",
    });
    const chart = await models.Chart.create({
      chartData: {
        data: {
          datasets: [{ data: [10, 20], label: "Orders" }],
          labels: ["Jan", "Feb"],
        },
      },
      chartDataUpdated: new Date("2026-08-20T00:00:00.000Z"),
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

    let finishSourceRequest;
    const requestSpy = vi.spyOn(DatasetController.prototype, "runRequest")
      .mockImplementation(() => new Promise((resolve, reject) => {
        finishSourceRequest = (error) => error ? reject(error) : resolve({
          data: [{ count: 10, month: "Jan" }, { count: 20, month: "Feb" }],
          options: dataset.toJSON(),
        });
      }));
    const dashboard = await new ProjectController().findById(project.id, {
      refreshPreparedData: true,
    });
    const inferred = dashboard.Charts.find((item) => item.id === chart.id);

    expect(JSON.parse(JSON.stringify(inferred))).not.toHaveProperty("chartData");
    expect(inferred.render).toMatchObject({ renderer: "echarts", stale: true, version: 1 });
    expect(inferred.render.configuration.dataset.source).toEqual([
      ["Jan", 10],
      ["Feb", 20],
    ]);

    await vi.waitFor(() => expect(requestSpy).toHaveBeenCalled());
    finishSourceRequest(new Error("Connection is temporarily unavailable"));
    await vi.waitFor(() => {
      expect(runtimeCache.inFlight.has(`prepared-snapshot-refresh:${chart.id}`)).toBe(false);
    });

    const compatibilitySnapshot = await models.Chart.unscoped().findByPk(chart.id);
    expect(compatibilitySnapshot.preparedData.__legacyChartData).toBe(true);
    const compatibilityRead = await new ChartController().findById(chart.id);
    expect(compatibilityRead.render).toMatchObject({ renderer: "echarts", stale: true, version: 1 });
    expect(compatibilityRead.render.configuration.dataset.source).toEqual([
      ["Jan", 10],
      ["Feb", 20],
    ]);

    requestSpy.mockResolvedValue({
      data: [{ count: 10, month: "Jan" }, { count: 20, month: "Feb" }],
      options: dataset.toJSON(),
    });
    const refreshRead = await new ChartController().findById(chart.id, null, {
      refreshPreparedData: true,
    });
    expect(refreshRead.render.stale).toBe(true);
    await runtimeCache.runSingleFlight(
      `prepared-snapshot-refresh:${chart.id}`,
      async () => null
    );

    const refreshed = await new ChartController().findById(chart.id);
    requestSpy.mockRestore();

    expect(refreshed.render).toMatchObject({ renderer: "echarts", stale: false, version: 1 });
    expect(refreshed.render.configuration.dataset.source).toEqual([
      ["Jan", 10],
      ["Feb", 20],
    ]);
    expect(refreshed.render.configuration.series[0].id)
      .toBe(refreshed.render.metadata.series[0].id);

    const stored = await models.Chart.unscoped().findByPk(chart.id);
    expect(stored.preparedData).toMatchObject({ version: 1 });
    expect(stored.preparedData.__legacyChartData).toBeUndefined();
    expect(stored.preparedDataFingerprint).toHaveLength(64);
    expect(stored.chartData).toMatchObject({ data: expect.any(Object) });

    const ordinary = await models.Chart.findByPk(chart.id);
    expect(ordinary.toJSON()).not.toHaveProperty("preparedData");

    await runtimeCache.resetForTests();
    const coldController = new ChartController();
    const coldRequestSpy = vi.spyOn(coldController.datasetController, "runRequest")
      .mockRejectedValue(new Error("Source must not run"));
    const coldRead = await coldController.findById(chart.id);

    expect(JSON.parse(JSON.stringify(coldRead))).not.toHaveProperty("chartData");
    expect(coldRead.render.renderer).toBe("echarts");
    expect(coldRead.render.configuration.dataset.source).toEqual([
      ["Jan", 10],
      ["Feb", 20],
    ]);
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
