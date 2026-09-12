import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { breakpoints, getLayouts, getReportOrder, appendCharts, validateLayout } from "../../../shared/dashboard/layout.mjs";

const { createPlacedChart, removePlacedChart, saveDashboardLayout } = require("../../modules/dashboardLayout");
const { createTemplateCharts } = require("../../templates/createTemplateCharts");

describe("Dashboard layout transactions", () => {
  let db;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });
  afterEach(() => vi.restoreAllMocks());

  async function fixture() {
    const team = await db.Team.create({ name: "Layout team" });
    const project = await db.Project.create({ team_id: team.id, name: "Layout", brewName: "layout", layoutCustom: ["lg"] });
    const add = (type = "kpi") => createPlacedChart({ project_id: project.id, name: type, type, draft: false });
    const payload = async () => {
      await project.reload();
      const charts = await db.Chart.findAll({ where: { project_id: project.id } });
      return { revision: project.layoutRevision, order: getReportOrder(charts, project.layoutOrder), layouts: getLayouts(charts), custom: project.layoutCustom };
    };
    return { project, add, payload };
  }

  it("serializes concurrent additions and rejects an editor opened before the additions", async () => {
    const { project, add, payload } = await fixture();
    await add();
    const stale = await payload();
    const created = await Promise.all([add(), add(), add()]);
    const current = await payload();
    expect(current.order).toHaveLength(4);
    expect(current.revision).toBe(4);
    expect(new Set(created.map((item) => item.layout.lg[1])).size).toBe(3);
    breakpoints.forEach((bp) => validateLayout(current.layouts[bp], bp));
    await expect(saveDashboardLayout(project.id, stale)).rejects.toMatchObject({ statusCode: 409 });
    expect((await payload()).layouts).toEqual(current.layouts);
  });

  it("keeps appended positions when an unchanged editor is saved", async () => {
    const { project, add, payload } = await fixture();
    await add();
    await add();
    const data = await payload();
    await saveDashboardLayout(project.id, data);
    expect((await payload()).layouts).toEqual(data.layouts);
  });

  it("allows a Desktop repair without changing overlapping legacy mobile widgets", async () => {
    const { project, add, payload } = await fixture();
    const first = await add();
    const second = await add();
    await second.update({ layout: { ...second.layout, xs: first.layout.xs } });
    const data = await payload();
    data.layouts.lg[1].x = 3;
    data.layouts.lg[1].y = 0;
    await saveDashboardLayout(project.id, data);
    expect((await second.reload()).layout.xs).toEqual(first.layout.xs);
    expect(second.layout.lg).toEqual([3, 0, 3, 1]);
  });

  it("saves moved widgets and staged text together and maps temporary IDs", async () => {
    const { project, add, payload } = await fixture();
    await add();
    const data = await payload();
    data.layouts.lg[0].y = 4;
    const staged = { id: "text-draft", type: "markdown", content: "A report note" };
    const rects = appendCharts([{ id: data.order[0], layout: { lg: [0, 4, 3, 1] } }], [staged]);
    breakpoints.forEach((bp) => {
      const [x, y, w, h] = rects[staged.id][bp];
      data.layouts[bp].push({ i: staged.id, x, y, w, h });
    });
    data.order.push(staged.id);
    data.staged = [staged];
    await saveDashboardLayout(project.id, data);
    const charts = await db.Chart.findAll({ where: { project_id: project.id }, order: [["id", "ASC"]] });
    expect(charts).toHaveLength(2);
    expect(charts[0].layout.lg[1]).toBe(4);
    expect(charts[1]).toMatchObject({ type: "markdown", content: "A report note" });
    expect((await project.reload()).layoutOrder).toEqual(charts.map((item) => String(item.id)));
  });

  it("rolls back all geometry and staged text when a write fails", async () => {
    const { project, add, payload } = await fixture();
    const chart = await add();
    const data = await payload();
    data.staged = [{ id: "text-draft", type: "markdown", content: "Do not save" }];
    data.order.push("text-draft");
    breakpoints.forEach((bp) => data.layouts[bp].push({ i: "text-draft", x: 0, y: 10, w: 2, h: 1 }));
    vi.spyOn(db.Chart, "update").mockRejectedValue(new Error("Write failed"));
    await expect(saveDashboardLayout(project.id, data)).rejects.toThrow("Write failed");
    expect(await db.Chart.count({ where: { project_id: project.id } })).toBe(1);
    expect((await chart.reload()).layout.lg).toEqual([0, 0, 3, 1]);
    expect((await project.reload()).layoutRevision).toBe(data.revision);
  });

  it("rejects overlapping layouts and charts outside the dashboard", async () => {
    const { project, add, payload } = await fixture();
    await add();
    await add();
    const data = await payload();
    data.layouts.lg[1].y = 0;
    await expect(saveDashboardLayout(project.id, data)).rejects.toThrow("overlap");
    data.order[0] = "99999999";
    await expect(saveDashboardLayout(project.id, data)).rejects.toThrow("widgets changed");
    expect((await project.reload()).layoutRevision).toBe(2);
  });

  it("saves batch reading order after grouping metrics and preserves existing order", async () => {
    const { project, add, payload } = await fixture();
    const first = await add();
    const second = await add();
    await project.update({ layoutOrder: [String(second.id), String(first.id)] });
    const batch = await createTemplateCharts([
      { name: "Metric", type: "kpi" }, { name: "Trend", type: "line" }, { name: "Second metric", type: "kpi" },
    ], project.id);
    const current = await payload();
    expect(current.order).toEqual([second, first, batch[0], batch[2], batch[1]].map(({ id }) => String(id)));
    breakpoints.forEach((bp) => validateLayout(current.layouts[bp], bp));
    await saveDashboardLayout(project.id, current);
    expect((await payload()).order).toEqual(current.order);
  });

  it("keeps a template batch together beside its own widgets and removes deleted IDs", async () => {
    const { project, add, payload } = await fixture();
    const first = await add();
    const [batch] = await Promise.all([
      createTemplateCharts([{ name: "First", type: "kpi" }, { name: "Second", type: "kpi" }], project.id),
      add("bar"),
    ]);
    expect(batch[0].layout.lg[1]).toBe(batch[1].layout.lg[1]);
    expect(batch[1].layout.lg[0]).toBe(6);
    const current = await payload();
    const index = current.order.indexOf(String(batch[0].id));
    expect(current.order[index + 1]).toBe(String(batch[1].id));
    breakpoints.forEach((bp) => validateLayout(current.layouts[bp], bp));
    await removePlacedChart(first.id);
    const next = await payload();
    expect(next.order).not.toContain(String(first.id));
    expect(next.revision).toBe(current.revision + 1);
  });
});
