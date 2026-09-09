import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const moveChart = require("../../modules/ai/orchestrator/tools/moveChartToDashboard");
const ChartController = require("../../controllers/ChartController");

describe("Preview placement transaction", () => {
  let db;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });
  afterEach(() => vi.restoreAllMocks());

  async function fixture() {
    const team = await db.Team.create({ name: "Preview team" });
    const projects = [];
    for (const name of ["Preview", "First", "Second"]) {
      projects.push(await db.Project.create({ team_id: team.id, name, brewName: name, ghost: name === "Preview" }));
    }
    const chart = await db.Chart.create({ project_id: projects[0].id, name: "Countries", type: "bar" });
    const dataset = await db.Dataset.create({ team_id: team.id, name: "Countries", project_ids: [] });
    await db.ChartDatasetConfig.create({ chart_id: chart.id, dataset_id: dataset.id });
    const refresh = vi.spyOn(ChartController.prototype, "updateChartData").mockResolvedValue(null);
    const place = (project) => moveChart({ chart_id: chart.id, target_project_id: project.id, team_id: team.id });
    return { projects, chart, dataset, refresh, place };
  }

  it("rolls back chart placement when the dataset update fails", async () => {
    const { projects, chart, dataset, refresh, place } = await fixture();
    vi.spyOn(db.Dataset.prototype, "update").mockRejectedValue(new Error("Dataset update failed"));
    await expect(place(projects[1])).rejects.toThrow("Dataset update failed");
    expect((await chart.reload()).project_id).toBe(projects[0].id);
    expect((await dataset.reload()).project_ids).toEqual([]);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("allows only one concurrent placement and refreshes after commit", async () => {
    const { projects, chart, dataset, refresh, place } = await fixture();
    const observed = [];
    refresh.mockImplementation(async () => {
      observed.push([(await db.Chart.findByPk(chart.id)).project_id, (await db.Dataset.findByPk(dataset.id)).project_ids]);
    });
    const results = await Promise.allSettled([place(projects[1]), place(projects[2])]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected").reason.statusCode).toBe(409);
    const winner = results.find((result) => result.status === "fulfilled").value.project_id;
    expect((await chart.reload()).project_id).toBe(winner);
    expect((await dataset.reload()).project_ids).toEqual([winner]);
    await Promise.all(refresh.mock.results.map((result) => result.value));
    expect(observed).toEqual([[winner, [winner]]]);
    await place(projects.find((project) => project.id === winner));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
