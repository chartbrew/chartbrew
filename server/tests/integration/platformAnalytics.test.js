import { beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import request from "supertest";

import { userFactory } from "../factories/userFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { generateTestToken, getAuthHeaders } from "../helpers/authHelpers.js";
import { getModels } from "../helpers/dbHelpers.js";
import { createTestAppWithPlatformSettingsRoutes } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);
const { getPlatformAnalytics, getTeamAnalytics } = require("../../modules/platformAnalytics");
const migration = require("../../models/migrations/20261001100000-index-source-execution-finished");
const now = new Date("2026-10-01T12:00:00Z");
let db;
let app;

function execution(finishedAt, milliseconds, overrides = {}) {
  return {
    id: randomUUID(), teamId: 1, connectionId: 1, sourceId: "api", activity: "manual",
    cacheHit: false, status: "success", finishedAt: new Date(finishedAt),
    startedAt: new Date(new Date(finishedAt).getTime() - milliseconds),
    ...overrides,
  };
}

describe("Platform analytics", () => {
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
    app = await createTestAppWithPlatformSettingsRoutes();
    require("../../api/TeamRoute")(app);
    require("../../api/AiRoute")(app);
  });

  it("counts completed uncached requests across teams and weights mean time by request", async () => {
    await db.SourceExecution.bulkCreate([
      execution("2026-09-25T00:00:00Z", 1000),
      execution("2026-10-01T01:00:00Z", 1000),
      execution("2026-10-01T02:00:00Z", 3000, { teamId: 2 }),
      execution("2026-10-01T03:00:00Z", 8000, { status: "failed" }),
      execution("2026-10-01T04:00:00Z", -1000),
      execution("2026-10-01T05:00:00Z", 2000, { cacheHit: true }),
      execution("2026-10-01T06:00:00Z", 2000, { status: "pending" }),
      execution("2026-10-01T07:00:00Z", 2000, { finishedAt: null }),
      execution("2026-09-24T23:59:59.999Z", 2000),
      execution(now, 2000),
      execution("2026-10-02T01:00:00Z", 2000),
    ]);

    const result = await getPlatformAnalytics("7", now);
    expect(result.summary).toEqual({ successful: 4, failed: 1, successRate: 80, meanSeconds: 3.25 });
    expect(result.from).toBe("2026-09-25T00:00:00.000Z");
    expect(result.to).toBe(now.toISOString());
    expect(result.daily).toHaveLength(7);
    expect(result.daily[0]).toMatchObject({ successful: 1, failed: 0, meanSeconds: 1 });
    expect(result.daily[1]).toMatchObject({ successful: 0, failed: 0, meanSeconds: null });
    expect(result.daily[6]).toMatchObject({ successful: 3, failed: 1, meanSeconds: 4 });
    expect(result.metrics.map((item) => item.value)).toEqual(["4", "1", "80%", "3.25 s"]);
    expect(result.charts.outcomes.configuration.series[0].type).toBe("bar");
    expect(result.charts.duration.configuration.series[0].type).toBe("line");
    expect(result.charts.duration.configuration.dataset.source[1][1]).toBeNull();
    expect(result.charts.outcomes.configuration.dataset.source[1].slice(1)).toEqual([0, 0]);
    expect(result.charts.outcomes.configuration.dataset.source).toHaveLength(7);
  });

  it("keeps sub-second timing precision and shows isolated daily values", async () => {
    await db.SourceExecution.create(execution("2026-10-01T01:00:00Z", 123));
    const result = await getPlatformAnalytics("7", now);
    const chart = result.charts.duration.configuration;
    expect(result.summary.meanSeconds).toBe(0.123);
    expect(chart.dataset.source[6][1]).toBe(0.123);
    expect(chart.dataset.source).toHaveLength(7);
    expect(chart.series[0].showSymbol).toBe(true);
    expect(chart.series[0].connectNulls).toBe(false);
    expect(chart.legend.show).toBe(false);
  });

  it("keeps empty means and rates unknown and spans UTC calendar days across years", async () => {
    const result = await getPlatformAnalytics("90", new Date("2026-01-01T12:00:00Z"));
    expect(result.summary).toEqual({ successful: 0, failed: 0, successRate: null, meanSeconds: null });
    expect(result.from).toBe("2025-10-04T00:00:00.000Z");
    expect(result.daily).toHaveLength(90);
    expect(result.metrics.slice(2).map((item) => item.value)).toEqual([null, null]);
    expect(result.ai.summary).toEqual({ calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, unknown: 0, pending: 0, legacy: 0 });
    expect(result.ai.models).toEqual([]);
    expect(result.ai.daily).toHaveLength(90);
  });

  it("separates incomplete AI use and aggregates complete tokens by day and model across teams", async () => {
    const teams = await db.Team.bulkCreate([teamFactory.build(), teamFactory.build()]);
    const usage = (overrides = {}) => ({
      team_id: teams[0].id, provider: "openai", model: "model-a", usage_status: "reported",
      prompt_tokens: 100, completion_tokens: 30, total_tokens: 130,
      cached_tokens: 60, reasoning_tokens: 20, createdAt: new Date("2026-10-01T01:00:00Z"),
      ...overrides,
    });
    await db.AiUsage.bulkCreate([
      usage({ createdAt: new Date("2026-09-25T00:00:00Z") }),
      usage({ team_id: teams[1].id, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, activity: "background" }),
      usage({ usage_status: "unknown", prompt_tokens: 99, completion_tokens: null, total_tokens: null }),
      usage({ usage_status: "pending", model: "model-b", prompt_tokens: null, completion_tokens: null, total_tokens: null }),
      usage({ usage_status: "rejected" }),
      usage({ usage_status: "legacy", provider: null, model: "older-model", prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 }),
      usage({ usage_status: "legacy", prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }),
      usage({ createdAt: new Date("2026-09-24T23:59:59Z") }),
      usage({ createdAt: now }),
      usage({ createdAt: new Date("2026-10-02T01:00:00Z") }),
    ]);

    const { ai } = await getPlatformAnalytics("7", now);
    expect(ai.summary).toEqual({ calls: 4, prompt_tokens: 120, completion_tokens: 35, total_tokens: 155, unknown: 1, pending: 1, legacy: 1 });
    expect(ai.daily).toHaveLength(7);
    expect(ai.daily[0]).toMatchObject({ calls: 1, total_tokens: 130 });
    expect(ai.daily[1]).toMatchObject({ calls: 0, total_tokens: 0, unknown: 0, pending: 0 });
    expect(ai.daily[6]).toMatchObject({ calls: 3, total_tokens: 25, unknown: 1, pending: 1 });
    expect(ai.models).toHaveLength(3);
    expect(ai.models[0]).toMatchObject({ provider: "openai", model: "model-a", calls: 3, total_tokens: 130, unknown: 1 });
    expect(ai.models[1]).toMatchObject({ provider: null, model: "older-model", calls: 1, total_tokens: 25 });
    expect(ai.models[2]).toMatchObject({ model: "model-b", calls: 0, total_tokens: 0, pending: 1 });
    expect(ai.metrics.map((item) => item.value)).toEqual(["4", "155", "120", "35"]);
    expect(ai.charts.tokens.configuration.dataset.source[0].slice(1)).toEqual([100, 30]);
    expect(ai.charts.tokens.configuration.dataset.source[1].slice(1)).toEqual([0, 0]);
    expect(ai.charts.tokens.configuration.yAxis).toMatchObject([
      { name: "Input tokens", position: "left", min: 0 },
      { name: "Output tokens", position: "right", min: 0, splitLine: { show: false } },
    ]);
    expect(ai.charts.tokens.configuration.series[1].yAxisIndex).toBe(1);
    expect(ai.charts.tokens.configuration.grid.top).toBe(64);
    expect(ai.charts.tokens.configuration.media.every(({ option }) => option.grid.top === 64)).toBe(true);
    expect(ai.charts.calls.configuration.dataset.source[6][1]).toBe(3);
  });

  it("requires a platform admin and rejects invalid or repeated periods", async () => {
    await request(app).get("/platform/analytics").expect(401);
    const user = await db.User.create(userFactory.build({ admin: false }));
    const headers = getAuthHeaders(generateTestToken({ id: user.id, email: user.email }));
    await request(app).get("/platform/analytics").set(headers).expect(403);
    await user.update({ admin: true });
    for (const query of ["days=0", "days=100000", "days=7&days=30", "days=7junk", "days="]) {
      await request(app).get(`/platform/analytics?${query}`).set(headers).expect(400);
    }
    const response = await request(app).get("/platform/analytics").set(headers).expect(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.days).toBe(30);
    expect(response.body.metrics).toHaveLength(4);
    expect(response.body.daily).toHaveLength(30);
    expect(response.body.ai.metrics).toHaveLength(4);
    expect(response.body.ai.daily).toHaveLength(30);
  });

  it("keeps team request and AI totals separate, including charts and incomplete counts", async () => {
    const teams = await db.Team.bulkCreate([teamFactory.build(), teamFactory.build(), teamFactory.build()]);
    await db.SourceExecution.bulkCreate([
      execution("2026-10-01T01:00:00Z", 1000, { teamId: teams[0].id }),
      execution("2026-10-01T01:00:00Z", 9000, { teamId: teams[1].id, status: "failed" }),
    ]);
    await db.AiUsage.bulkCreate(teams.slice(0, 2).flatMap((team, index) => ["reported", "unknown", "pending", "legacy"].map((status) => ({
      team_id: team.id, model: `private-model-${index}`, provider: "openai", usage_status: status,
      prompt_tokens: (index + 1) * 100, completion_tokens: 30, total_tokens: (index + 1) * 100 + 30,
      createdAt: new Date("2026-10-01T01:00:00Z"),
    }))));

    const result = await getTeamAnalytics(teams[0].id, "7", now);
    expect(result.summary).toEqual({ successful: 1, failed: 0, successRate: 100, meanSeconds: 1 });
    expect(result.daily[6]).toMatchObject({ successful: 1, failed: 0, meanSeconds: 1 });
    expect(result.charts.outcomes.configuration.dataset.source[6].slice(1)).toEqual([1, 0]);
    expect(result.ai.summary).toMatchObject({ calls: 3, total_tokens: 260, unknown: 1, pending: 1 });
    expect(result.ai.daily[6]).toMatchObject({ calls: 3, total_tokens: 260, unknown: 1, pending: 1 });
    expect(result.ai.metrics.map((item) => item.value)).toEqual(["3", "260", "200", "60"]);
    expect(result.ai.charts.tokens.configuration.dataset.source[6].slice(1)).toEqual([200, 60]);
    expect(result.ai).not.toHaveProperty("models");
    expect(JSON.stringify(result)).not.toContain("private-model");

    const other = await getTeamAnalytics(teams[1].id, "7", now);
    expect(other.summary).toEqual({ successful: 0, failed: 1, successRate: 0, meanSeconds: 9 });
    expect(other.ai.summary.total_tokens).toBe(460);
    const empty = await getTeamAnalytics(teams[2].id, "7", now);
    expect(empty.summary.successful + empty.summary.failed).toBe(0);
    expect(empty.ai.summary.calls).toBe(0);
    for (const id of [undefined, null, 0, -1, "1", NaN, 1.5]) {
      await expect(getTeamAnalytics(id, "7", now)).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it("checks the route's team on every request and never grants platform access to team admins", async () => {
    const user = await db.User.create(userFactory.build({ admin: false }));
    const teams = await db.Team.bulkCreate([teamFactory.build(), teamFactory.build()]);
    const role = await db.TeamRole.create({ user_id: user.id, team_id: teams[0].id, role: "teamOwner" });
    const headers = getAuthHeaders(generateTestToken({ id: user.id, email: user.email }));
    const ownUrl = `/team/${teams[0].id}/analytics`;
    const otherUrl = `/team/${teams[1].id}/analytics`;
    const finishedAt = new Date(Date.now() - 10000).toISOString();
    await db.SourceExecution.bulkCreate([
      execution(finishedAt, 1000, { teamId: teams[0].id }),
      execution(finishedAt, 9000, { teamId: teams[1].id, status: "failed" }),
    ]);
    await db.AiUsage.bulkCreate(teams.map((team, index) => ({
      team_id: team.id, model: "private-model", usage_status: "reported",
      prompt_tokens: (index + 1) * 100, completion_tokens: 30, total_tokens: (index + 1) * 100 + 30,
      createdAt: new Date(finishedAt),
    })));

    await request(app).get(ownUrl).expect(401);
    for (const allowedRole of ["teamOwner", "teamAdmin"]) {
      await role.update({ role: allowedRole });
      const response = await request(app).get(`${ownUrl}?teamId=${teams[1].id}&team_id=${teams[1].id}`).set(headers).expect(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body.summary).toMatchObject({ successful: 1, failed: 0, meanSeconds: 1 });
      expect(response.body.ai.summary.total_tokens).toBe(130);
      expect(response.body.ai).not.toHaveProperty("models");
      await request(app).get(`${otherUrl}?teamId=${teams[0].id}`).set(headers).expect(403);
      await request(app).get("/platform/analytics").set(headers).expect(403);
      const usage = await request(app).get(`/ai/usage/${teams[0].id}`).set(headers).expect(200);
      expect(usage.body.total.total_tokens).toBe(130);
      await request(app).get(`/ai/usage/${teams[1].id}?teamId=${teams[0].id}`).set(headers).expect(403);
    }
    for (const query of ["days=0", "days=7&days=30", "days=7junk"]) {
      await request(app).get(`${ownUrl}?${query}`).set(headers).expect(400);
    }
    for (const id of ["0", "-1", "1junk", "1.5", "9007199254740992"]) {
      await request(app).get(`/team/${id}/analytics`).set(headers).expect(400);
    }
    for (const deniedRole of ["projectAdmin", "projectEditor", "projectViewer", "guest"]) {
      await role.update({ role: deniedRole });
      await request(app).get(ownUrl).set(headers).expect(403);
      await request(app).get(`/ai/usage/${teams[0].id}`).set(headers).expect(403);
    }
    await role.destroy();
    await request(app).get(ownUrl).set(headers).expect(403);
    await user.update({ admin: true });
    await request(app).get(otherUrl).set(headers).expect(403);
    const platform = await request(app).get("/platform/analytics").set(headers).expect(200);
    expect(platform.body.summary).toMatchObject({ successful: 1, failed: 1 });
    expect(platform.body.ai.summary.total_tokens).toBe(360);
  });

  it("can roll back and apply the platform date index", async () => {
    const query = db.sequelize.getQueryInterface();
    expect((await query.showIndex("SourceExecution")).map((index) => index.name)).toContain("source_execution_finished");
    await migration.down(query);
    await migration.up(query);
    expect((await query.showIndex("SourceExecution")).map((index) => index.name)).toContain("source_execution_finished");
  });
});
