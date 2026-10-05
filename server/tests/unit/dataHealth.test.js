import {
  afterEach, beforeEach, describe, expect, it, vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { Op } = require("sequelize");
const db = require("../../models/models");
const HomeController = require("../../controllers/HomeController");

const access = { allProjects: true, projectIds: [], teamId: 2, userId: 3 };

function chartRun(overrides = {}) {
  return {
    Chart: { id: 4, name: "Revenue" },
    Project: { id: 10, name: "Sales" },
    chartId: 4,
    entityType: "chart",
    id: 11,
    projectId: 10,
    startedAt: new Date(),
    status: "failed",
    ...overrides,
  };
}

describe("data health removal", () => {
  let runs;
  let monitors;
  let dismissals;
  let saveDismissal;

  beforeEach(() => {
    runs = vi.spyOn(db.UpdateRun, "findAll").mockResolvedValue([]);
    monitors = vi.spyOn(db.MetricMonitor, "findAll").mockResolvedValue([]);
    dismissals = vi.spyOn(db.DataHealthDismissal, "findAll").mockResolvedValue([]);
    saveDismissal = vi.spyOn(db.DataHealthDismissal, "findOrCreate").mockResolvedValue([{}, true]);
  });

  afterEach(() => vi.restoreAllMocks());

  it("excludes deleted targets and charts whose dashboard was deleted", async () => {
    runs.mockResolvedValue([
      chartRun({ Chart: null }),
      chartRun({ Project: null }),
      chartRun({ chartId: null, connectionId: 7, entityType: "connection", Connection: null }),
      chartRun({ chartId: null, datasetId: 8, entityType: "dataset", Dataset: null }),
      chartRun({ chartId: null, entityType: "project", Project: null }),
      chartRun({ id: 12, chartId: 5, Chart: { id: 5, name: "Orders" } }),
    ]);

    const health = await new HomeController().getDataHealth(access);

    expect(health.count).toBe(1);
    expect(health.active[0]).toMatchObject({
      action: { path: "/dashboard/10/chart/5/edit" },
      id: "run:chart:5:12",
    });
  });

  it("removes the latest failure without showing an older failure", async () => {
    runs.mockResolvedValue([
      chartRun(),
      chartRun({ id: 9, startedAt: new Date(Date.now() - 1000) }),
    ]);
    const controller = new HomeController();

    expect(await controller.dismissDataHealth(access, "run:chart:4:11"))
      .toEqual({ removed: true });
    expect(saveDismissal).toHaveBeenCalledWith({
      where: { issue_id: "run:chart:4:11", team_id: 2, user_id: 3 },
    });
    dismissals.mockResolvedValue([{ issue_id: "run:chart:4:11" }]);

    expect(await controller.getDataHealth(access)).toMatchObject({
      active: [], count: 0, items: [], resolved: [],
    });
    expect(dismissals).toHaveBeenLastCalledWith(expect.objectContaining({
      where: {
        issue_id: { [Op.in]: ["run:chart:4:11"] },
        team_id: 2,
        user_id: 3,
      },
    }));
  });

  it("shows a new failure after an earlier failure was removed", async () => {
    runs.mockResolvedValue([
      chartRun({ id: 12 }),
      chartRun({ startedAt: new Date(Date.now() - 1000) }),
    ]);
    dismissals.mockResolvedValue([{ issue_id: "run:chart:4:11" }]);

    const health = await new HomeController().getDataHealth(access);

    expect(health.count).toBe(1);
    expect(health.active[0].id).toBe("run:chart:4:12");
  });

  it("keeps removed failures out of recovered history", async () => {
    runs.mockResolvedValue([
      chartRun({ id: 12, status: "success" }),
      chartRun({ startedAt: new Date(Date.now() - 1000) }),
    ]);
    const controller = new HomeController();
    const health = await controller.getDataHealth(access);
    expect(health.resolved[0].id).toBe("run:chart:4:11");
    await controller.dismissDataHealth(access, health.resolved[0].id);
    dismissals.mockResolvedValue([{ issue_id: health.resolved[0].id }]);

    expect((await controller.getDataHealth(access)).resolved).toEqual([]);
  });

  it("keeps recovery evidence from a chart that was later deleted", async () => {
    runs.mockResolvedValue([
      chartRun({ Chart: null, connectionId: 7, id: 12, status: "success" }),
      chartRun({
        Connection: { id: 7, name: "Database" },
        connectionId: 7,
        errorStage: "connection",
        startedAt: new Date(Date.now() - 1000),
      }),
    ]);

    const health = await new HomeController().getDataHealth(access);

    expect(health.active).toEqual([]);
    expect(health.resolved[0]).toMatchObject({ status: "resolved", type: "connection" });
  });

  it("allows a new watched metric issue without disabling the metric", async () => {
    const monitor = {
      id: "metric-1",
      name: "Revenue",
      status: "waiting_for_data",
      status_reason: "no_data",
      updatedAt: new Date(Date.now() - 1000),
    };
    monitors.mockResolvedValue([monitor]);
    const controller = new HomeController();
    const health = await controller.getDataHealth(access);
    await controller.dismissDataHealth(access, health.active[0].id);
    dismissals.mockResolvedValue([{ issue_id: health.active[0].id }]);
    expect((await controller.getDataHealth(access)).active).toEqual([]);

    monitors.mockResolvedValue([{ ...monitor, updatedAt: new Date() }]);
    expect((await controller.getDataHealth(access)).count).toBe(1);
    expect(monitor.status).toBe("waiting_for_data");
  });

  it("rejects issues outside the user's dashboard access and unknown issue IDs", async () => {
    runs.mockResolvedValue([chartRun()]);
    const controller = new HomeController();

    await expect(controller.dismissDataHealth({
      ...access, allProjects: false, projectIds: [20],
    }, "run:chart:4:11")).rejects.toMatchObject({ statusCode: 404 });
    await expect(controller.dismissDataHealth(access, "run:chart:4:999"))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(saveDismissal).not.toHaveBeenCalled();
    expect(runs).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ teamId: 2 }),
    }));
  });

  it("updates activity counts when a data health issue is removed", async () => {
    const ObservationController = require("../../controllers/ObservationController");
    vi.spyOn(ObservationController.prototype, "countUnread").mockResolvedValue(6);
    runs.mockResolvedValue([chartRun()]);
    const controller = new HomeController();
    expect(await controller.getActivityCounts(access)).toEqual({ changes: 6, dataHealth: 1, total: 7 });

    dismissals.mockResolvedValue([{ issue_id: "run:chart:4:11" }]);
    expect(await controller.getActivityCounts(access)).toEqual({ changes: 6, dataHealth: 0, total: 6 });
  });
});
