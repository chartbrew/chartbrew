import express from "express";
import { createRequire } from "module";
import jwt from "jsonwebtoken";
import request from "supertest";
import {
  beforeAll, beforeEach, describe, expect, it,
} from "vitest";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);

describe("Data API key security", () => {
  let app;
  let db;
  let settings;
  let TeamController;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
    settings = require("../../settings-dev.js");
    TeamController = require("../../controllers/TeamController.js");
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const verifyDataApiKey = require("../../modules/verifyDataApiKey.js");
    app.get("/protected", verifyDataApiKey("data:read"), (req, res) => {
      return res.json(req.apiKeyAccess);
    });
  });

  async function createFixture({
    role = "teamOwner",
    roleProjects,
    allProjects = false,
    keyProjects,
    scopes = ["data:read"],
  } = {}) {
    const team = await db.Team.create({ name: "Team" });
    const user = await db.User.create({
      name: "Key owner",
      email: `owner-${Date.now()}-${Math.random()}@example.com`,
      password: "password",
      active: true,
      tutorials: {},
    });
    const firstProject = await db.Project.create({
      team_id: team.id,
      name: "First",
      brewName: `first-${Date.now()}-${Math.random()}`,
    });
    const secondProject = await db.Project.create({
      team_id: team.id,
      name: "Second",
      brewName: `second-${Date.now()}-${Math.random()}`,
    });
    await db.TeamRole.create({
      team_id: team.id,
      user_id: user.id,
      role,
      projects: roleProjects || [firstProject.id],
    });

    const controller = new TeamController();
    const createdKey = await controller.createApiKey(team.id, user, {
      name: "Data key",
      scopes,
      allProjects,
      projectIds: keyProjects || (allProjects ? [] : [firstProject.id]),
    });

    return {
      createdKey, firstProject, secondProject, team, user,
    };
  }

  it.each([
    ["teamOwner", ["first"]],
    ["teamAdmin", ["first"]],
    ["projectAdmin", ["first"]],
    ["projectEditor", ["first"]],
    ["projectViewer", ["first"]],
  ])("applies stored project restrictions for %s", async (role, expectedNames) => {
    const fixture = await createFixture({ role });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${fixture.createdKey.token}`);

    const projectNames = response.body.projectIds.map((id) => {
      if (id === fixture.firstProject.id) return "first";
      if (id === fixture.secondProject.id) return "second";
      return "unknown";
    });
    expect(response.status).toBe(200);
    expect(projectNames).toEqual(expectedNames);
    expect(response.body.role).toBe(role);
    expect(response.body).not.toHaveProperty("token");
  });

  it.each([
    ["teamOwner", 2],
    ["teamAdmin", 2],
    ["projectAdmin", 1],
    ["projectEditor", 1],
    ["projectViewer", 1],
  ])("uses current role access for an all-project %s key", async (role, expectedCount) => {
    const fixture = await createFixture({ role, allProjects: true });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${fixture.createdKey.token}`);

    expect(response.status).toBe(200);
    expect(response.body.projectIds).toHaveLength(expectedCount);
  });

  it("rejects legacy and session-style tokens", async () => {
    const team = await db.Team.create({ name: "Team" });
    const user = await db.User.create({
      name: "Legacy owner",
      email: "legacy@example.com",
      password: "password",
      active: true,
      tutorials: {},
    });
    await db.TeamRole.create({ team_id: team.id, user_id: user.id, role: "teamOwner" });
    const controller = new TeamController();
    const legacyKey = await controller.createApiKey(team.id, user, { name: "Legacy key" });
    const sessionToken = jwt.sign({ id: user.id }, settings.encryptionKey);

    for (const token of [legacyKey.token, sessionToken]) {
      const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("API_KEY_INVALID");
    }
  });

  it("rejects deleted, blacklisted, and cross-team key records", async () => {
    const deleted = await createFixture();
    await db.Apikey.destroy({ where: { id: deleted.createdKey.id } });

    const blacklisted = await createFixture();
    await db.TokenBlacklist.create({ token: blacklisted.createdKey.token });

    const crossTeam = await createFixture();
    const otherTeam = await db.Team.create({ name: "Other team" });
    await db.Apikey.update({ team_id: otherTeam.id }, { where: { id: crossTeam.createdKey.id } });

    for (const token of [deleted.createdKey.token, blacklisted.createdKey.token, crossTeam.createdKey.token]) {
      const response = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("API_KEY_INVALID");
    }
  });

  it("rejects a key when its owner no longer has a team role", async () => {
    const fixture = await createFixture();
    await db.TeamRole.destroy({ where: { team_id: fixture.team.id, user_id: fixture.user.id } });

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${fixture.createdKey.token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("API_KEY_INVALID");
  });

  it("rejects disabled users and keys without the required scope", async () => {
    const disabled = await createFixture();
    await db.User.update({ active: false }, { where: { id: disabled.user.id } });

    const missingScope = await createFixture();
    await db.Apikey.update({ scopes: [] }, { where: { id: missingScope.createdKey.id } });

    const disabledResponse = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${disabled.createdKey.token}`);
    const scopeResponse = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${missingScope.createdKey.token}`);

    expect(disabledResponse.status).toBe(401);
    expect(disabledResponse.body.error.code).toBe("API_KEY_INVALID");
    expect(scopeResponse.status).toBe(403);
    expect(scopeResponse.body.error.code).toBe("API_KEY_SCOPE_REQUIRED");
  });

  it("rejects share-style tokens", async () => {
    const fixture = await createFixture();
    const shareToken = jwt.sign({
      id: fixture.user.id,
      teamId: fixture.team.id,
      tokenType: "share",
    }, settings.encryptionKey);

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${shareToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("API_KEY_INVALID");
  });

  it("creates and lists scoped keys through the key-management API", async () => {
    const fixture = await createFixture();
    const managementApp = express();
    managementApp.use(express.json());
    require("../../api/TeamRoute.js")(managementApp);
    const sessionToken = jwt.sign({
      id: fixture.user.id,
      email: fixture.user.email,
    }, settings.encryptionKey);

    const createResponse = await request(managementApp)
      .post(`/team/${fixture.team.id}/apikey`)
      .set("Authorization", `Bearer ${sessionToken}`)
      .send({
        name: "Management API key",
        scopes: ["data:read", "data:refresh"],
        allProjects: false,
        projectIds: [fixture.firstProject.id],
      });

    expect(createResponse.status).toBe(200);
    expect(jwt.verify(createResponse.body.token, settings.encryptionKey)).toMatchObject({
      id: fixture.user.id,
      apiKeyId: createResponse.body.id,
      teamId: fixture.team.id,
      tokenType: "api_key",
    });

    const listResponse = await request(managementApp)
      .get(`/team/${fixture.team.id}/apikey`)
      .set("Authorization", `Bearer ${sessionToken}`);
    const listItem = listResponse.body.find((key) => key.id === createResponse.body.id);

    expect(listResponse.status).toBe(200);
    expect(listItem).toMatchObject({
      dataApiAccess: "ready",
      permissions: ["data:read", "data:refresh"],
      projectAccess: {
        allProjects: false,
        projectIds: [fixture.firstProject.id],
      },
    });
    expect(listItem).not.toHaveProperty("token");
  });

  it("tracks successful use without writing again inside five minutes", async () => {
    const fixture = await createFixture();

    await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${fixture.createdKey.token}`)
      .expect(200);
    const firstUse = await db.Apikey.findByPk(fixture.createdKey.id);

    await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${fixture.createdKey.token}`)
      .expect(200);
    const secondUse = await db.Apikey.findByPk(fixture.createdKey.id);

    expect(firstUse.last_used_at).not.toBeNull();
    expect(secondUse.last_used_at.getTime()).toBe(firstUse.last_used_at.getTime());
  });

  it("lists legacy keys without tokens and does not revoke them when a new scoped key is created", async () => {
    const fixture = await createFixture();
    const controller = new TeamController();
    const legacyKey = await controller.createApiKey(fixture.team.id, fixture.user, { name: "Legacy key" });
    const newScopedKey = await controller.createApiKey(fixture.team.id, fixture.user, {
      name: legacyKey.name,
      scopes: ["data:read"],
      allProjects: false,
      projectIds: [fixture.firstProject.id],
    });

    const keys = await controller.getApiKeys(fixture.team.id);
    const legacyListItem = keys.find((key) => key.id === legacyKey.id);
    const scopedListItem = keys.find((key) => key.id === newScopedKey.id);

    expect(legacyListItem.dataApiAccess).toBe("unavailable");
    expect(legacyListItem).not.toHaveProperty("token");
    expect(scopedListItem.dataApiAccess).toBe("ready");
    expect(await db.Apikey.findByPk(legacyKey.id)).not.toBeNull();
  });
});
