import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createTestApp } from "../helpers/testApp.js";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { teamFactory } from "../factories/teamFactory.js";
import { userFactory } from "../factories/userFactory.js";

const service = require("../../modules/ai/homeSuggestions/service");
const { setPlatformSettingOverrides } = require("../../modules/platformSettings/runtime");
const { getObservationAccess } = require("../../modules/observations/access");
const registerTeam = require("../../api/TeamRoute");
const registerHome = require("../../api/ObservationRoute");

describe("Home suggestion access and persistence", () => {
  let models;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    models = await getModels();
  });
  afterEach(() => { setPlatformSettingOverrides({}); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  async function seed() {
    vi.stubEnv("CB_OPENAI_API_KEY_DEV", "test-key");
    setPlatformSettingOverrides({ "workspaceOrchestrator.enabled": true });
    const user = await models.User.create(userFactory.build());
    const team = await models.Team.create(teamFactory.build());
    const role = await models.TeamRole.create({ user_id: user.id, team_id: team.id, role: "teamOwner" });
    const app = await createTestApp();
    registerTeam(app);
    registerHome(app);
    const token = generateTestToken({ id: user.id });
    const access = await getObservationAccess(team.id, user.id);
    return { user, team, role, app, token, access };
  }

  it("defaults on, validates booleans and rejects a viewer's setting change", async () => {
    const { team, role, app, token } = await seed();
    expect(team.aiSuggestionsEnabled).toBe(true);
    const url = `/team/${team.id}`;
    expect((await request(app).put(url).auth(token, { type: "bearer" }).send({ aiSuggestionsEnabled: "false" })).status).toBe(400);
    expect((await request(app).put(url).auth(token, { type: "bearer" }).send({ aiSuggestionsEnabled: false })).status).toBe(200);
    expect((await team.reload()).aiSuggestionsEnabled).toBe(false);
    await role.update({ role: "projectViewer" });
    expect((await request(app).put(url).auth(token, { type: "bearer" }).send({ aiSuggestionsEnabled: true })).status).not.toBe(200);
    expect((await team.reload()).aiSuggestionsEnabled).toBe(false);
  });

  it("records authenticated visits, but not ordinary Home reads or disabled personalization", async () => {
    const { team, user, app, token, access } = await seed();
    expect(await service.readSuggestions(access)).toEqual([]);
    expect(await models.AiHomeState.count()).toBe(0);
    const url = `/team/${team.id}/home/activity`;
    expect((await request(app).post(url).auth(token, { type: "bearer" }).send({})).status).toBe(200);
    const state = await models.AiHomeState.findOne({ where: { team_id: team.id, user_id: user.id } });
    expect(state.last_active_at).toBeTruthy();
    await state.destroy();
    await team.update({ aiSuggestionsEnabled: false });
    expect((await request(app).post(url).auth(token, { type: "bearer" }).send({})).status).toBe(200);
    expect(await models.AiHomeState.count()).toBe(0);
  });

  it("queues an immediate personal refresh with access, settings and cooldown checks", async () => {
    const { team, user, role, app, token } = await seed();
    const queue = { add: vi.fn().mockResolvedValue({ id: "refresh" }) };
    app.set("homeSuggestionsQueue", queue);
    await role.update({ role: "projectViewer" });
    const url = `/team/${team.id}/home/suggestions/refresh`;
    expect((await request(app).post(url).auth(token, { type: "bearer" }).send({ userId: 999 })).status).toBe(202);
    expect(queue.add).toHaveBeenCalledWith("homeSuggestions", { teamId: team.id, userId: user.id, manual: true }, expect.objectContaining({ attempts: 1 }));
    const jobOptions = queue.add.mock.calls[0][2];
    expect(jobOptions.delay).toBeUndefined();
    expect(jobOptions.deduplication).toEqual({ id: `home-suggestions-manual-${team.id}-${user.id}` });
    expect(jobOptions.jobId).toBeUndefined();
    expect(jobOptions.removeOnComplete).toBeUndefined();
    expect(jobOptions.removeOnFail).toBeUndefined();
    const state = await models.AiHomeState.findOne({ where: { team_id: team.id, user_id: user.id } });
    expect(state.last_active_at).toBeTruthy();
    await state.update({ last_attempt_at: new Date() });
    expect((await request(app).post(url).auth(token, { type: "bearer" })).status).toBe(429);
    await team.update({ aiSuggestionsEnabled: false });
    expect((await request(app).post(url).auth(token, { type: "bearer" })).status).toBe(403);
    expect(queue.add).toHaveBeenCalledTimes(1);
    await team.update({ aiSuggestionsEnabled: true });
    await state.update({ last_attempt_at: null });
    queue.add.mockRejectedValue(new Error("Redis unavailable"));
    expect((await request(app).post(url).auth(token, { type: "bearer" })).status).toBe(500);
    await role.destroy();
    expect((await request(app).post(url).auth(token, { type: "bearer" })).status).toBe(403);
  });

  it("forgets work without replay and keeps another user's state private", async () => {
    const { team, user, app, token, access } = await seed();
    await service.recordActivity(access);
    const state = await models.AiHomeState.findOne();
    await state.update({ payload: { memories: [{ id: "work-1", source: "chat:old", text: "Private report" }], suggestions: [{ id: "suggestion-1" }] } });
    const other = await models.User.create(userFactory.build());
    await models.TeamRole.create({ team_id: team.id, user_id: other.id, role: "projectViewer" });
    const otherToken = generateTestToken({ id: other.id });
    const url = `/team/${team.id}/home/memories?id=work-1`;
    await request(app).delete(url).auth(otherToken, { type: "bearer" });
    expect((await state.reload()).payload.memories).toHaveLength(1);
    expect((await request(app).delete(url).auth(token, { type: "bearer" })).status).toBe(200);
    expect((await state.reload()).payload).toMatchObject({ memories: [], suggestions: [], forgottenSources: ["chat:old"] });
    await service.changeState(access, { forget: true });
    expect((await state.reload()).forgotten_before).toBeTruthy();
    expect(state.user_id).toBe(user.id);
  });
});
