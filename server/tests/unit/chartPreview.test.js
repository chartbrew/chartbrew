import { afterEach, describe, expect, it, vi } from "vitest";

const db = require("../../models/models");
const ChartController = require("../../controllers/ChartController");
const { getPreview, placePreview } = require("../../controllers/ChartPreviewController");

describe("Signed-in chart previews", () => {
  afterEach(() => vi.restoreAllMocks());

  function setup({ role = "teamAdmin", projects = [], ghost = true, datasetProjects = [10] } = {}) {
    const chart = { id: 1, name: "Countries", type: "bar", project_id: 10,
      Project: { id: 10, team_id: 7, name: "Dashboard", ghost },
      ChartDatasetConfigs: [{ Dataset: { id: 2, team_id: 7, project_ids: datasetProjects } }] };
    vi.spyOn(db.Chart, "findByPk").mockResolvedValue(chart);
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role, projects });
    vi.spyOn(ChartController.prototype, "findById").mockResolvedValue(chart);
    return chart;
  }

  it("loads a temporary preview and resolves its current dashboard after placement", async () => {
    const chart = setup();
    expect(await getPreview(1, 5)).toMatchObject({ teamId: 7, parsed: { visibility: "temporary", dashboard: null } });
    chart.Project.ghost = false;
    expect(await getPreview(1, 5)).toMatchObject({ parsed: { visibility: "dashboard", dashboard: { id: 10 } } });
  });

  it("denies other teams, missing previews, and invalid IDs before loading chart data", async () => {
    setup();
    db.TeamRole.findOne.mockResolvedValue(null);
    await expect(getPreview(1, 5)).rejects.toMatchObject({ statusCode: 403 });
    db.Chart.findByPk.mockResolvedValue(null);
    await expect(getPreview(1, 5)).rejects.toMatchObject({ statusCode: 404 });
    await expect(getPreview("bad", 5)).rejects.toMatchObject({ statusCode: 404 });
    expect(ChartController.prototype.findById).not.toHaveBeenCalled();
  });

  it("checks dataset access for restricted team members", async () => {
    setup({ role: "projectEditor", projects: [20] });
    await expect(getPreview(1, 5)).rejects.toMatchObject({ statusCode: 403 });
    expect(ChartController.prototype.findById).not.toHaveBeenCalled();
  });

  it("does not let viewers place a preview", async () => {
    setup({ role: "projectViewer", projects: [10] });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({ id: 10 });
    await expect(placePreview(1, 10, 5)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("does not move a saved chart to another dashboard", async () => {
    setup({ ghost: false });
    vi.spyOn(db.Project, "findOne").mockResolvedValue({ id: 20 });
    await expect(placePreview(1, 20, 5)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("places a preview and returns the saved dashboard on subsequent loads", async () => {
    const chart = setup();
    const target = { id: 20, team_id: 7, name: "Visits", ghost: false };
    vi.spyOn(db.Project, "findOne").mockResolvedValue(target);
    vi.spyOn(db.Project, "findByPk").mockImplementation(async (id) => Number(id) === 20 ? target : chart.Project);
    vi.spyOn(db.Chart, "findAll").mockResolvedValue([]);
    vi.spyOn(db.ChartDatasetConfig, "findAll").mockResolvedValue([]);
    vi.spyOn(db.Dataset, "findAll").mockResolvedValue([]);
    vi.spyOn(db.sequelize, "transaction").mockImplementation(async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
    vi.spyOn(db.Chart, "update").mockImplementation(async () => {
      chart.project_id = 20;
      chart.Project = target;
    });
    expect(await placePreview(1, 20, 5)).toMatchObject({ parsed: { visibility: "dashboard", projectId: 20 } });
    expect(await getPreview(1, 5)).toMatchObject({ parsed: { dashboard: { id: 20, name: "Visits" } } });
  });
});
