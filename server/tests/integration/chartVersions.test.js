import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const versions = require("../../modules/chartVersions");
const history = require("../../controllers/ChartVersionController");
const ChartController = require("../../controllers/ChartController");
const DatasetController = require("../../controllers/DatasetController");
const updateChart = require("../../modules/ai/orchestrator/tools/updateChart");

describe("Chart version history", () => {
  let db;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });
  afterEach(() => vi.restoreAllMocks());

  async function fixture() {
    const team = await db.Team.create({ name: "History" });
    const user = await db.User.create({ name: "Editor", email: `${randomUUID()}@example.test`, password: "test-only" });
    const project = await db.Project.create({ team_id: team.id, name: "History", brewName: randomUUID(), ghost: false });
    const role = await db.TeamRole.create({ team_id: team.id, user_id: user.id, role: "teamOwner" });
    const dataset = await db.Dataset.create({ team_id: team.id, name: "Revenue", project_ids: [project.id], draft: false });
    const chart = await db.Chart.create({ project_id: project.id, name: "Original", type: "bar", draft: false });
    const binding = await db.ChartDatasetConfig.create({ chart_id: chart.id, dataset_id: dataset.id,
      xAxis: "root[].month", yAxis: "root[].amount", yAxisOperation: "none", legend: "Revenue",
      conditions: [{ field: "root[].month", operator: "is", value: "Jan", values: ["Jan", "Feb"] }] });
    const controller = new ChartController();
    await controller.syncLegacyVisualization(chart.id);
    const context = { userId: user.id, projectId: project.id, expectedVersion: 0, operationId: randomUUID() };
    return { team, user, project, role, dataset, chart, binding, controller, context };
  }

  it("saves manual and AI changes, rejects stale writes, and restores without changing shared data", async () => {
    const f = await fixture();
    const original = await versions.captureConfiguration(f.chart.id);
    expect(original.bindings[0].conditions[0]).not.toHaveProperty("values");
    const shared = f.dataset.toJSON();
    await f.controller.update(f.chart.id, { name: "Manual title" }, f.user, false, f.context);
    expect((await db.ChartVersion.findAll({ order: [["version", "ASC"]] })).map((item) => item.origin)).toEqual(["baseline", "manual"]);
    await f.controller.update(f.chart.id, { name: "Manual title" }, f.user, false, f.context);
    expect(await db.ChartVersion.count()).toBe(2);
    await expect(f.controller.update(f.chart.id, { name: "Stale" }, f.user, false,
      { ...f.context, operationId: randomUUID() })).rejects.toMatchObject({ statusCode: 409 });

    vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(null);
    vi.spyOn(ChartController.prototype, "takeSnapshot").mockResolvedValue(null);
    await updateChart({ chart_id: f.chart.id, team_id: f.team.id, user_id: f.user.id,
      expectedVersion: 2, operationId: randomUUID(), name: "AI title", legend: "AI series" });
    expect((await db.ChartVersion.findOne({ where: { version: 3 } })).origin).toBe("ai");
    expect((await f.binding.reload()).legend).toBe("AI series");
    await versions.restoreVersion(f.chart.id, 1, { ...f.context, expectedVersion: 3, operationId: randomUUID() });
    expect(versions.sameConfiguration(original, await versions.captureConfiguration(f.chart.id))).toBe(true);
    expect((await f.dataset.reload()).toJSON()).toEqual(shared);
    expect((await db.ChartVersion.findOne({ where: { version: 4 } })).summary).toBe("Restored version 1");
  });

  it("rolls back failed changes and keeps the newest 100 complete versions", async () => {
    const f = await fixture();
    await expect(versions.saveChartVersion(f.chart.id, f.context, async ({ chart, transaction }) => {
      await chart.update({ name: "Invalid" }, { transaction });
      throw new Error("Save failed");
    })).rejects.toThrow("Save failed");
    expect((await f.chart.reload()).name).toBe("Original");
    expect(await db.ChartVersion.count()).toBe(0);

    await Array.from({ length: 101 }).reduce((previous, _, index) => previous.then(async (expectedVersion) => {
      const saved = await versions.saveChartVersion(f.chart.id,
        { ...f.context, expectedVersion, operationId: randomUUID() },
        ({ chart, transaction }) => chart.update({ name: `Title ${index}` }, { transaction }));
      return saved.configurationVersion;
    }), Promise.resolve(0));
    expect(await db.ChartVersion.count()).toBe(100);
    expect(await db.ChartVersion.min("version")).toBe(3);
    expect(await db.ChartVersion.max("version")).toBe(102);
    const page = await history.list(f.chart.id, undefined, f.context);
    expect(page.versions).toHaveLength(25);
    expect(page.versions[0]).not.toHaveProperty("configuration");
    await expect(history.detail(f.chart.id, 1, f.context)).rejects.toMatchObject({ statusCode: 404 });
    const competing = await Promise.allSettled(["First", "Second"].map((name) => versions.saveChartVersion(f.chart.id,
      { ...f.context, expectedVersion: 102, operationId: randomUUID() },
      ({ chart, transaction }) => chart.update({ name }, { transaction }))));
    expect(competing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(competing.find((result) => result.status === "rejected").reason.statusCode).toBe(409);
  });

  it("previews current data without chart writes and checks current access", async () => {
    const f = await fixture();
    await f.controller.update(f.chart.id, { name: "Later" }, f.user, false, f.context);
    const before = (await f.chart.reload()).toJSON();
    const read = vi.spyOn(DatasetController.prototype, "runRequest").mockResolvedValue({
      data: [{ month: "Jan", amount: 40 }], options: f.dataset.toJSON(),
    });
    const preview = await history.preview(f.chart.id, 1, f.context);
    expect(preview.name).toBe("Original");
    expect(preview.render.configuration.dataset.source).toEqual([["Jan", 40]]);
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ maintainDatasetMetadata: false, writeRuntimeSourceCache: false }));
    expect((await f.chart.reload()).toJSON()).toEqual(before);
    expect(await db.ChartVersion.count()).toBe(2);
    await f.role.update({ role: "projectViewer", projects: [f.project.id] });
    await expect(history.list(f.chart.id, undefined, f.context)).rejects.toMatchObject({ statusCode: 403 });
    await f.role.update({ role: "projectEditor", projects: [f.project.id] });
    await f.dataset.update({ project_ids: [] });
    await expect(history.preview(f.chart.id, 1, f.context)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("restores removed bindings, preserves alerts, and ignores unchanged saves", async () => {
    const f = await fixture();
    await f.controller.update(f.chart.id, { name: "Later" }, f.user, false, f.context);
    await f.controller.update(f.chart.id, { name: "Later", draft: true }, f.user, false,
      { ...f.context, expectedVersion: 2, operationId: randomUUID() });
    expect(await db.ChartVersion.count()).toBe(2);
    const extra = await f.controller.createChartDatasetConfig(f.chart.id, { dataset_id: f.dataset.id },
      { ...f.context, chartId: f.chart.id, expectedVersion: 2, operationId: randomUUID() });
    const alert = await db.Alert.create({ chart_id: f.chart.id, cdc_id: extra.id, type: "threshold" });
    await expect(versions.restoreVersion(f.chart.id, 1,
      { ...f.context, expectedVersion: 3, operationId: randomUUID() })).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.Alert.count()).toBe(1);
    expect(await db.ChartVersion.count()).toBe(3);
    await alert.destroy();
    await f.controller.deleteChartDatasetConfig(f.binding.id,
      { ...f.context, chartId: f.chart.id, expectedVersion: 3, operationId: randomUUID() });
    const restore = { ...f.context, expectedVersion: 4, operationId: randomUUID() };
    await versions.restoreVersion(f.chart.id, 1, restore);
    const restored = await versions.captureConfiguration(f.chart.id);
    expect(restored.bindings).toHaveLength(1);
    expect(restored.bindings[0].id).not.toBe(f.binding.id);
    expect(restored.chart.visualization.layers[0].bindingId).toBe(restored.bindings[0].id);
    expect((await f.chart.reload()).draft).toBe(true);
    await versions.restoreVersion(f.chart.id, 1, restore);
    expect(await db.ChartVersion.count()).toBe(5);
  });
});
