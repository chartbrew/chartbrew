import {
  beforeAll, beforeEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);

describe("Runtime cache integration", () => {
  let models;
  let ChartController;
  let DatasetController;
  let runtimeCache;
  let buildChartRuntimeContext;
  let getSourceById;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    models = await getModels();
    ChartController = require("../../controllers/ChartController.js");
    DatasetController = require("../../controllers/DatasetController.js");
    runtimeCache = require("../../modules/runtimeCache.js");
    ({ buildChartRuntimeContext } = require("../../modules/chartRuntimeFilters.js"));
    ({ getSourceById } = require("../../sources/index.js"));
  });

  beforeEach(async () => {
    await models.sequelize.sync({ force: true });
    await runtimeCache.resetForTests();
  });

  it("includes the canonical visualization in the chart fingerprint", async () => {
    const team = await models.Team.create({ name: "Fingerprint Team" });
    const project = await models.Project.create({
      team_id: team.id,
      name: "Fingerprint Project",
      brewName: "fingerprint-project",
      ghost: false,
    });
    const chart = await models.Chart.create({
      project_id: project.id,
      name: "Fingerprint Chart",
      type: "bar",
      draft: false,
      visualization: {
        version: 2,
        layers: [{ id: "value", bindingId: 1, mark: "bar", encoding: {} }],
      },
    });
    const before = await runtimeCache.buildChartVersion(chart.id, "UTC");

    await chart.update({
      visualization: {
        version: 2,
        layers: [{ id: "value", bindingId: 1, mark: "bar", encoding: {}, goal: 500 }],
      },
    }, { silent: true });
    const after = await runtimeCache.buildChartVersion(chart.id, "UTC");

    expect(after).not.toBe(before);
  });

  it("reuses the chart-result cache for identical runtime filter combinations", async () => {
    const team = await models.Team.create({ name: "Runtime Cache Team" });
    const project = await models.Project.create({
      team_id: team.id,
      name: "Runtime Cache Project",
      brewName: "runtime-cache-project",
      ghost: false,
    });
    const chart = await models.Chart.create({
      project_id: project.id,
      name: "Cached Chart",
      type: "bar",
      draft: false,
    });
    const dataset = await models.Dataset.create({
      team_id: team.id,
      project_ids: [project.id],
      draft: false,
      name: "Cached Dataset",
      legend: "Cached Dataset",
      xAxis: "root[].month",
      yAxis: "root[].count",
      yAxisOperation: "none",
      conditions: [],
      fieldsSchema: {
        "root[].month": "string",
        "root[].count": "number",
        "root[].status": "string",
      },
    });

    await models.ChartDatasetConfig.create({
      chart_id: chart.id,
      dataset_id: dataset.id,
      xAxis: "root[].month",
      yAxis: "root[].count",
      yAxisOperation: "none",
      legend: "Cached Series",
      conditions: [],
    });

    const controller = new ChartController();
    const runRequestSpy = vi.spyOn(DatasetController.prototype, "runRequest")
      .mockResolvedValue({
        options: dataset.toJSON(),
        data: [
          { month: "Jan", count: 1, status: "paid" },
          { month: "Feb", count: 2, status: "pending" },
        ],
      });

    const requestOptions = {
      filters: [{
        type: "field",
        field: "root[].status",
        operator: "is",
        value: "paid",
      }],
      runtimeOnly: true,
      noSource: true,
      skipParsing: false,
      getCache: true,
    };

    const firstChart = await controller.updateChartData(chart.id, null, requestOptions);
    const secondChart = await controller.updateChartData(chart.id, null, requestOptions);

    runRequestSpy.mockRestore();

    expect(firstChart.chartData.data.labels).toEqual(["Jan"]);
    expect(firstChart.cacheStatus).toBe("miss");
    expect(secondChart.chartData.data.labels).toEqual(["Jan"]);
    expect(secondChart.cacheStatus).toBe("hit");
  });

  it("reuses source cache across parse-only runtime filter variants", async () => {
    const team = await models.Team.create({ name: "Runtime Source Cache Team" });
    const project = await models.Project.create({
      team_id: team.id,
      name: "Runtime Source Cache Project",
      brewName: "runtime-source-cache-project",
      ghost: false,
    });
    const dataset = await models.Dataset.create({
      team_id: team.id,
      project_ids: [project.id],
      draft: false,
      name: "Source Dataset",
      legend: "Source Dataset",
      xAxis: "root[].month",
      yAxis: "root[].count",
      yAxisOperation: "none",
      conditions: [],
      fieldsSchema: {
        "root[].month": "string",
        "root[].count": "number",
        "root[].status": "string",
      },
    });
    const connection = await models.Connection.create({
      team_id: team.id,
      project_ids: [project.id],
      name: "Source Connection",
      type: "postgres",
      host: "localhost",
    });
    const dataRequest = await models.DataRequest.create({
      dataset_id: dataset.id,
      connection_id: connection.id,
      query: "select month, count, status from orders",
    });
    await dataset.update({ main_dr_id: dataRequest.id });

    const datasetController = new DatasetController();
    const postgresSource = getSourceById("postgres");
    const sourceQuerySpy = vi.spyOn(postgresSource.backend, "runDataRequest")
      .mockResolvedValue({
        dataRequest: {
          id: dataRequest.id,
          Connection: { type: "postgres" },
        },
        responseData: {
          data: [
            { month: "Jan", count: 1, status: "paid" },
            { month: "Feb", count: 2, status: "pending" },
          ],
        },
      });

    const firstRuntimeContext = buildChartRuntimeContext({}, [{
      type: "field",
      field: "root[].status",
      operator: "is",
      value: "paid",
    }], {}, "UTC");
    const secondRuntimeContext = buildChartRuntimeContext({}, [{
      type: "field",
      field: "root[].status",
      operator: "is",
      value: "pending",
    }], {}, "UTC");

    const firstResponse = await datasetController.runRequest({
      dataset_id: dataset.id,
      chart_id: null,
      noSource: false,
      getCache: false,
      filters: firstRuntimeContext.filters,
      timezone: "UTC",
      variables: {},
      team_id: team.id,
      runtimeContext: firstRuntimeContext,
      readRuntimeSourceCache: true,
      writeRuntimeSourceCache: true,
    });

    const secondResponse = await datasetController.runRequest({
      dataset_id: dataset.id,
      chart_id: null,
      noSource: false,
      getCache: false,
      filters: secondRuntimeContext.filters,
      timezone: "UTC",
      variables: {},
      team_id: team.id,
      runtimeContext: secondRuntimeContext,
      readRuntimeSourceCache: true,
      writeRuntimeSourceCache: true,
    });

    sourceQuerySpy.mockRestore();

    expect(firstResponse.cacheMetadata?.sourceCache?.cacheStatus).toBe("miss");
    expect(secondResponse.cacheMetadata?.sourceCache?.cacheStatus).toBe("hit");
    expect(secondResponse.data).toEqual([
      { month: "Jan", count: 1, status: "paid" },
      { month: "Feb", count: 2, status: "pending" },
    ]);
  });
});
