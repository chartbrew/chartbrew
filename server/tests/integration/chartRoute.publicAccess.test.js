import {
  beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createRequire } from "module";

import { createTestApp } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { userFactory } from "../factories/userFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { projectFactory } from "../factories/projectFactory.js";

const require = createRequire(import.meta.url);
const ChartController = require("../../controllers/ChartController.js");

function generateProjectShareToken(projectId, sharePolicyId) {
  return jwt.sign(
    { sub: { type: "Project", id: projectId, sharePolicyId } },
    process.env.CB_SECRET_DEV,
    { expiresIn: "1h" }
  );
}

async function seedPublicChart(models, {
  allowReportExport = false,
  chartOverrides = {},
  projectOverrides = {},
  sharePolicy = null,
} = {}) {
  const team = await models.Team.create(teamFactory.build({
    allowReportExport,
  }));

  const project = await models.Project.create(projectFactory.buildPublic({
    team_id: team.id,
    ghost: false,
    ...projectOverrides,
  }));

  const chart = await models.Chart.create({
    project_id: project.id,
    name: "Public Revenue",
    type: "line",
    draft: false,
    chartData: {
      labels: ["Jan"],
      datasets: [{ label: "Revenue", data: [42] }],
    },
    chartDataUpdated: new Date(),
    onReport: true,
    ...chartOverrides,
  });

  const createdSharePolicy = sharePolicy
    ? await models.SharePolicy.create({
      entity_type: "Project",
      entity_id: project.id,
      ...sharePolicy,
    })
    : null;

  return {
    team,
    project,
    chart,
    sharePolicy: createdSharePolicy,
  };
}

describe("ChartRoute public access", () => {
  let app;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    app = await createTestApp();
    const chartRoute = require("../../api/ChartRoute.js");
    chartRoute(app);
    models = await getModels();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks direct public chart retrieval for charts hidden from the report", async () => {
    const seeded = await seedPublicChart(models, {
      chartOverrides: {
        onReport: false,
      },
    });

    const response = await request(app)
      .get(`/chart/${seeded.chart.id}`)
      .expect(401);

    expect(response.body).toEqual({ error: "Not authorized" });
  });

  it("blocks direct public chart retrieval when the project share policy requires a token", async () => {
    const seeded = await seedPublicChart(models, {
      sharePolicy: {
        visibility: "private",
      },
    });

    const response = await request(app)
      .get(`/chart/${seeded.chart.id}`)
      .expect(401);

    expect(response.body).toEqual({ error: "Not authorized" });
  });

  it("allows direct public chart retrieval with the project password and a valid project share token", async () => {
    const seeded = await seedPublicChart(models, {
      projectOverrides: {
        passwordProtected: true,
        password: "report-secret",
      },
      sharePolicy: {
        visibility: "private",
      },
    });

    const shareToken = generateProjectShareToken(seeded.project.id, seeded.sharePolicy.id);

    const response = await request(app)
      .get(`/chart/${seeded.chart.id}`)
      .query({
        password: "report-secret",
        token: shareToken,
      })
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      id: seeded.chart.id,
      project_id: seeded.project.id,
      chartData: seeded.chart.chartData,
    }));
  });

  it("blocks public export for charts hidden from the report", async () => {
    const exportSpy = vi.spyOn(ChartController.prototype, "exportChartData")
      .mockResolvedValue([]);
    const seeded = await seedPublicChart(models, {
      allowReportExport: true,
      chartOverrides: {
        onReport: false,
      },
    });

    const response = await request(app)
      .post(`/project/${seeded.project.id}/chart/export/public/${seeded.chart.id}`)
      .send({})
      .expect(401);

    expect(response.body).toEqual({
      message: "Not authorized",
      error: "Not authorized",
    });
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it("allows public export with the project password and a valid project share token", async () => {
    vi.spyOn(ChartController.prototype, "exportChartData")
      .mockResolvedValue([
        {
          name: "Public Export",
          datasets: [{}],
          data: {
            rows: [{ value: 42 }],
          },
        },
      ]);

    const seeded = await seedPublicChart(models, {
      allowReportExport: true,
      projectOverrides: {
        passwordProtected: true,
        password: "report-secret",
      },
      sharePolicy: {
        visibility: "private",
      },
    });

    const shareToken = generateProjectShareToken(seeded.project.id, seeded.sharePolicy.id);

    const response = await request(app)
      .post(`/project/${seeded.project.id}/chart/export/public/${seeded.chart.id}`)
      .send({
        password: "report-secret",
        token: shareToken,
      })
      .expect(200);

    expect(response.body).toBeInstanceOf(Buffer);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it("blocks public chart refresh for private projects even when report refresh is enabled", async () => {
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData")
      .mockResolvedValue({ id: 999 });
    const seeded = await seedPublicChart(models, {
      projectOverrides: {
        public: false,
      },
    });

    await models.Team.update(
      { allowReportRefresh: true },
      { where: { id: seeded.team.id } }
    );

    const response = await request(app)
      .post(`/chart/${seeded.chart.id}/query`)
      .send({ variables: {} })
      .expect(401);

    expect(response.body).toEqual({ error: "Not authorized" });
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("blocks public chart refresh for charts hidden from the report", async () => {
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData")
      .mockResolvedValue({ id: 999 });
    const seeded = await seedPublicChart(models, {
      chartOverrides: {
        onReport: false,
      },
    });

    await models.Team.update(
      { allowReportRefresh: true },
      { where: { id: seeded.team.id } }
    );

    const response = await request(app)
      .post(`/chart/${seeded.chart.id}/query`)
      .send({ variables: {} })
      .expect(401);

    expect(response.body).toEqual({ error: "Not authorized" });
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("blocks public chart refresh when the project share policy requires a token", async () => {
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData")
      .mockResolvedValue({ id: 999 });
    const seeded = await seedPublicChart(models, {
      sharePolicy: {
        visibility: "private",
      },
    });

    await models.Team.update(
      { allowReportRefresh: true },
      { where: { id: seeded.team.id } }
    );

    const response = await request(app)
      .post(`/chart/${seeded.chart.id}/query`)
      .send({ variables: {} })
      .expect(401);

    expect(response.body).toEqual({ error: "Not authorized" });
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it("allows public chart refresh with report password and valid project share token", async () => {
    const refreshedChart = {
      id: 123,
      chartData: {
        labels: ["Feb"],
        datasets: [{ label: "Revenue", data: [84] }],
      },
      project_id: 456,
    };
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData")
      .mockResolvedValue(refreshedChart);
    const seeded = await seedPublicChart(models, {
      projectOverrides: {
        passwordProtected: true,
        password: "report-secret",
      },
      sharePolicy: {
        visibility: "private",
      },
    });

    await models.Team.update(
      { allowReportRefresh: true },
      { where: { id: seeded.team.id } }
    );

    const shareToken = generateProjectShareToken(seeded.project.id, seeded.sharePolicy.id);

    const response = await request(app)
      .post(`/chart/${seeded.chart.id}/query`)
      .send({
        password: "report-secret",
        token: shareToken,
        variables: { region: "eu" },
      })
      .expect(200);

    expect(response.body).toEqual(refreshedChart);
    expect(refreshSpy).toHaveBeenCalledWith(
      `${seeded.chart.id}`,
      null,
      expect.objectContaining({
        variables: { region: "eu" },
        traceContext: expect.objectContaining({
          triggerType: "chart_manual",
          entityType: "chart",
          teamId: seeded.team.id,
          projectId: seeded.project.id,
          chartId: seeded.chart.id,
        }),
      })
    );

    const updateRun = await models.UpdateRun.findOne({
      where: {
        triggerType: "chart_manual",
        entityType: "chart",
        teamId: seeded.team.id,
        projectId: seeded.project.id,
        chartId: seeded.chart.id,
      },
    });
    expect(updateRun).not.toBeNull();
    expect(updateRun.summary).toEqual(expect.objectContaining({
      publicReportRefresh: true,
    }));
  });

  it("allows authenticated project members to refresh a password-protected public report without report password", async () => {
    const refreshedChart = {
      id: 123,
      chartData: {
        labels: ["Feb"],
        datasets: [{ label: "Revenue", data: [84] }],
      },
      project_id: 456,
    };
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData")
      .mockResolvedValue(refreshedChart);
    const seeded = await seedPublicChart(models, {
      projectOverrides: {
        passwordProtected: true,
        password: "report-secret",
      },
      sharePolicy: {
        visibility: "private",
      },
    });
    const user = await models.User.create(userFactory.build());

    await models.Team.update(
      { allowReportRefresh: true },
      { where: { id: seeded.team.id } }
    );
    await models.TeamRole.create({
      team_id: seeded.team.id,
      user_id: user.id,
      role: "projectViewer",
      projects: [seeded.project.id],
    });

    const shareToken = generateProjectShareToken(seeded.project.id, seeded.sharePolicy.id);
    const authToken = generateTestToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const response = await request(app)
      .post(`/chart/${seeded.chart.id}/query`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        token: shareToken,
        variables: { region: "eu" },
      })
      .expect(200);

    expect(response.body).toEqual(refreshedChart);
    expect(refreshSpy).toHaveBeenCalledWith(
      `${seeded.chart.id}`,
      null,
      expect.objectContaining({
        variables: { region: "eu" },
      })
    );
  });

  it("merges share policy and URL parameters when refreshing a public chart", async () => {
    const refreshedChart = {
      id: 123,
      chartData: {
        labels: ["Feb"],
        datasets: [{ label: "Revenue", data: [84] }],
      },
      project_id: 456,
    };
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData")
      .mockResolvedValue(refreshedChart);
    const seeded = await seedPublicChart(models, {
      sharePolicy: {
        visibility: "private",
        allow_params: true,
        params: [
          { key: "accountId", value: "policy-account" },
          { key: "lockedRegion", value: "emea" },
        ],
      },
    });

    await models.Team.update(
      { allowReportRefresh: true },
      { where: { id: seeded.team.id } }
    );

    const shareToken = generateProjectShareToken(seeded.project.id, seeded.sharePolicy.id);

    const filters = [{ type: "date", startDate: "2026-01-01", endDate: "2026-01-31" }];

    await request(app)
      .post(`/chart/${seeded.chart.id}/query`)
      .send({
        token: shareToken,
        filters,
        variables: { dashboardVariable: "visible-filter" },
        queryParams: {
          token: shareToken,
          theme: "dark",
          accountId: "url-account",
          plan: "enterprise",
        },
      })
      .expect(200);

    expect(refreshSpy).toHaveBeenCalledWith(
      `${seeded.chart.id}`,
      null,
      expect.objectContaining({
        filters,
        variables: {
          accountId: "url-account",
          lockedRegion: "emea",
          plan: "enterprise",
          dashboardVariable: "visible-filter",
        },
      })
    );
  });

  it("merges share policy and URL parameters when refreshing a public filtered chart", async () => {
    const seeded = await seedPublicChart(models, {
      sharePolicy: {
        visibility: "private",
        allow_params: true,
        params: [
          { key: "accountId", value: "policy-account" },
        ],
      },
    });
    const refreshedChart = {
      id: seeded.chart.id,
      chartData: {
        labels: ["Feb"],
        datasets: [{ label: "Revenue", data: [84] }],
      },
      project_id: seeded.project.id,
    };
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData")
      .mockResolvedValue(refreshedChart);

    await models.Team.update(
      { allowReportRefresh: true },
      { where: { id: seeded.team.id } }
    );

    const shareToken = generateProjectShareToken(seeded.project.id, seeded.sharePolicy.id);
    const filters = [{ type: "field", field: "root[].status", operator: "eq", value: "active" }];

    await request(app)
      .post(`/project/${seeded.project.id}/chart/${seeded.chart.id}/filter`)
      .query({
        token: shareToken,
        refresh: "true",
      })
      .send({
        filters,
        variables: { dashboardVariable: "visible-filter" },
        queryParams: {
          token: shareToken,
          accountId: "url-account",
        },
      })
      .expect(200);

    expect(refreshSpy).toHaveBeenCalledWith(
      `${seeded.chart.id}`,
      undefined,
      expect.objectContaining({
        filters,
        variables: {
          accountId: "url-account",
          dashboardVariable: "visible-filter",
        },
        runtimeOnly: true,
      })
    );
  });

  it("passes cache-only public filtered refreshes without requiring source refresh permission", async () => {
    const seeded = await seedPublicChart(models, {
      sharePolicy: {
        visibility: "private",
        allow_params: true,
      },
    });
    const cachedChart = {
      id: seeded.chart.id,
      chartData: {
        labels: ["Cached"],
        datasets: [{ label: "Revenue", data: [42] }],
      },
      project_id: seeded.project.id,
    };
    const refreshSpy = vi.spyOn(ChartController.prototype, "updateChartData")
      .mockResolvedValue(cachedChart);
    const shareToken = generateProjectShareToken(seeded.project.id, seeded.sharePolicy.id);
    const filters = [{ type: "field", field: "root[].status", operator: "eq", value: "active" }];

    const response = await request(app)
      .post(`/project/${seeded.project.id}/chart/${seeded.chart.id}/filter`)
      .query({
        token: shareToken,
        getCache: "true",
        cacheOnly: "true",
      })
      .send({
        filters,
        queryParams: {
          token: shareToken,
          accountId: "url-account",
        },
      })
      .expect(200);

    expect(response.body).toEqual(cachedChart);
    expect(refreshSpy).toHaveBeenCalledWith(
      `${seeded.chart.id}`,
      undefined,
      expect.objectContaining({
        filters,
        getCache: true,
        cacheOnly: true,
        variables: {
          accountId: "url-account",
        },
        runtimeOnly: true,
      })
    );
  });
});
