import express from "express";
import { createRequire } from "module";
import request from "supertest";
import {
  afterAll, beforeAll, beforeEach, describe, expect, it, vi,
} from "vitest";

import { generateTestToken } from "../helpers/authHelpers.js";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);
const ChartImageController = require("../../controllers/ChartImageController.js");
const chartImageBodyError = require("../../modules/chartImageBodyError.js");
const { persistPreparedSnapshot } = require("../../modules/preparedSnapshot.js");
const runtimeCache = require("../../modules/runtimeCache.js");

function field(key, role = "dimension", type = "nominal") {
  return { key, role, sourceField: `root[].${key}`, type };
}

function imageFixture() {
  const series = [{
    id: "series-1111111111111111",
    key: "string:__default__",
    label: "Revenue",
    value: null,
  }];
  return {
    preparedData: {
      frameVersion: 1,
      generatedAt: "2026-08-24T03:30:00.000Z",
      identityVersion: 1,
      resource: { id: 1, kind: "chart" },
      results: [{
        availableSeries: series,
        bindingId: "binding-1",
        fields: [field("category"), field("value", "measure", "quantitative")],
        id: "layer-1",
        mark: "line",
        name: "Revenue",
        rows: [
          { category: "Jan", seriesId: series[0].id, value: 12 },
          { category: "Feb", seriesId: series[0].id, value: 25 },
        ],
        series,
        stats: { inputRows: 2, outputRows: 2 },
        warnings: [],
      }],
      stats: { inputRows: 2, outputRows: 2 },
      timezone: "UTC",
      version: 1,
      warnings: [],
    },
    visualization: {
      layers: [{
        bindingId: "binding-1",
        encoding: {
          category: { field: "root[].month", type: "nominal" },
          value: { aggregate: "sum", field: "root[].revenue", type: "quantitative" },
        },
        goal: null,
        id: "layer-1",
        mark: "line",
        name: "Revenue",
        orientation: "vertical",
        stack: "none",
        style: { color: "#048BDE", fill: false, fillOpacity: 0.2 },
        transforms: [],
      }],
      settings: {
        dataLabels: false,
        legend: { visible: true },
        missingValues: { policy: "preserve" },
      },
      status: "ready",
      version: 2,
    },
  };
}

function binaryParser(res, callback) {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

describe("chart image route", () => {
  let app;
  let controller;
  let db;
  let fixture;
  let routeMiddleware;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });

  beforeEach(async () => {
    if (controller?.queue) await controller.queue.close();
    await db.sequelize.sync({ force: true });
    await runtimeCache.resetForTests();

    const team = await db.Team.create({ name: "Image team", showBranding: true });
    const user = await db.User.create({
      active: true,
      email: `image-${Date.now()}-${Math.random()}@example.com`,
      name: "Image user",
      password: "password",
      tutorials: {},
    });
    const project = await db.Project.create({
      brewName: `image-${Date.now()}-${Math.random()}`,
      dashboardTitle: "Image dashboard",
      ghost: false,
      name: "Image project",
      team_id: team.id,
      timezone: "UTC",
    });
    const role = await db.TeamRole.create({
      canExport: false,
      projects: [project.id],
      role: "teamOwner",
      team_id: team.id,
      user_id: user.id,
    });
    const data = imageFixture();
    const chart = await db.Chart.create({
      draft: false,
      name: "Private image chart",
      project_id: project.id,
      public: false,
      shareable: false,
      type: "line",
      visualization: data.visualization,
    });
    data.preparedData.resource.id = chart.id;
    const fingerprints = await runtimeCache.buildChartFingerprints(chart.id, project.timezone);
    await persistPreparedSnapshot({
      chartId: chart.id,
      fingerprints,
      preparedData: data.preparedData,
    });
    const token = generateTestToken({ id: user.id, email: user.email, name: undefined });
    fixture = {
      chart, data, project, role, team, token, user,
    };

    app = express();
    app.set("trust proxy", 1);
    app.use(express.json({
      limit: 16 * 1024,
      verify: (req, _res, buffer, encoding) => {
        req.rawBody = buffer.toString(encoding || "utf8");
      },
    }));
    app.use(chartImageBodyError);
    controller = new ChartImageController({ recordEvent: vi.fn() });
    routeMiddleware = require("../../api/ChartImageRoute.js")(app, {
      controller,
      rateLimiter: (_req, _res, next) => next(),
    });
  });

  afterAll(async () => {
    if (controller?.queue) await controller.queue.close();
  });

  function post(body = { version: 1 }, token = fixture.token) {
    return request(app)
      .post(`/project/${fixture.project.id}/chart/${fixture.chart.id}/image`)
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send(body);
  }

  it("returns a bounded private PNG for an authenticated private chart", async () => {
    expect(typeof routeMiddleware).toBe("function");
    const response = await post()
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(response.headers["content-type"]).toMatch(/^image\/png/);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers.etag).toBeUndefined();
    expect([...response.body.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  it("rejects absent, invalid, share-style, and API key tokens", async () => {
    const noToken = await request(app)
      .post(`/project/${fixture.project.id}/chart/${fixture.chart.id}/image`)
      .set("Content-Type", "application/json")
      .send({ version: 1 });
    expect(noToken.status).toBe(401);
    expect(noToken.body.error.code).toBe("AUTHENTICATION_REQUIRED");

    await post({ version: 1 }, "invalid").expect(401);
    const shareToken = generateTestToken({ tokenType: "share" });
    await post({ version: 1 }, shareToken).expect(401);

    const TeamController = require("../../controllers/TeamController.js");
    const apiKey = await new TeamController().createApiKey(fixture.team.id, fixture.user, {
      name: "Legacy API key",
    });
    const apiKeyResponse = await post({ version: 1 }, apiKey.token).expect(401);
    expect(apiKeyResponse.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it.each(["projectAdmin", "projectEditor", "projectViewer"])(
    "enforces export permission for %s",
    async (role) => {
      await fixture.role.update({ canExport: false, role });
      const denied = await post().expect(403);
      await fixture.role.update({ canExport: true });
      const allowed = await post().expect(200);
      expect(denied.body.error.code).toBe("IMAGE_EXPORT_FORBIDDEN");
      expect(allowed.headers["content-type"]).toMatch(/^image\/png/);
    }
  );

  it("requires the chart to belong to the route project", async () => {
    const otherProject = await db.Project.create({
      brewName: `image-other-${Date.now()}-${Math.random()}`,
      ghost: false,
      name: "Other project",
      team_id: fixture.team.id,
      timezone: "UTC",
    });
    const response = await request(app)
      .post(`/project/${otherProject.id}/chart/${fixture.chart.id}/image`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({ version: 1 })
      .expect(404);
    expect(response.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("rejects a project from another team", async () => {
    const otherTeam = await db.Team.create({ name: "Other image team", showBranding: true });
    const otherProject = await db.Project.create({
      brewName: `image-cross-team-${Date.now()}-${Math.random()}`,
      ghost: false,
      name: "Other team project",
      team_id: otherTeam.id,
      timezone: "UTC",
    });
    const response = await request(app)
      .post(`/project/${otherProject.id}/chart/${fixture.chart.id}/image`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .set("Content-Type", "application/json")
      .send({ version: 1 })
      .expect(403);
    expect(response.body.error.code).toBe("IMAGE_EXPORT_FORBIDDEN");
  });

  it("returns stable errors for invalid contracts and unavailable snapshots", async () => {
    const invalid = await post({ unknown: true, version: 1 }).expect(400);
    expect(invalid.body.error).toEqual({
      code: "INVALID_IMAGE_OPTIONS",
      message: "One or more image options are not valid.",
      requestId: expect.any(String),
    });

    await db.Chart.unscoped().update({ preparedData: null }, { where: { id: fixture.chart.id } });
    const unavailable = await post().expect(503);
    expect(unavailable.body.error.code).toBe("IMAGE_DATA_UNAVAILABLE");
  });

  it("lets white-label bypass team branding settings", async () => {
    const body = { content: { branding: "whiteLabel" }, version: 1 };
    const response = await post(body).expect(200);
    expect(response.headers["content-type"]).toMatch(/^image\/png/);
  });

  it("maps malformed and oversized JSON to stable image errors", async () => {
    const malformed = await request(app)
      .post(`/project/${fixture.project.id}/chart/${fixture.chart.id}/image`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .set("Content-Type", "application/json")
      .send("{")
      .expect(400);
    expect(malformed.body.error.code).toBe("INVALID_IMAGE_OPTIONS");

    const tooLarge = await post({ padding: "x".repeat(17 * 1024), version: 1 }).expect(413);
    expect(tooLarge.body.error.code).toBe("IMAGE_TOO_LARGE");

    const parserTooLarge = await post({ padding: "x".repeat(101 * 1024), version: 1 }).expect(413);
    expect(parserTooLarge.body.error.code).toBe("IMAGE_TOO_LARGE");
  });

  it("limits image rendering to 30 requests per user each minute", async () => {
    if (controller?.queue) await controller.queue.close();
    const limitedApp = express();
    limitedApp.set("trust proxy", 1);
    limitedApp.use(express.json());
    require("../../api/ChartImageRoute.js")(limitedApp, {
      controller: { render: vi.fn().mockResolvedValue(Buffer.from([137, 80, 78, 71])) },
    });
    const send = () => request(limitedApp)
      .post(`/project/${fixture.project.id}/chart/${fixture.chart.id}/image`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({ version: 1 });
    const allowed = await Promise.all(Array.from({ length: 30 }, send));
    const limited = await send();
    expect(allowed.every((response) => response.status === 200)).toBe(true);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("IMAGE_RATE_LIMITED");
  });
});
