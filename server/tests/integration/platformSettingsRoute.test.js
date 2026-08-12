import {
  beforeAll, beforeEach, describe, expect, it
} from "vitest";
import request from "supertest";

import { userFactory } from "../factories/userFactory.js";
import { generateTestToken, getAuthHeaders } from "../helpers/authHelpers.js";
import { getModels } from "../helpers/dbHelpers.js";
import { createTestAppWithPlatformSettingsRoutes } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";

const {
  getWorkspaceOrchestratorPolicy,
} = require("../../modules/workspaceContext/policy.js");
const {
  setPlatformSettingOverrides,
} = require("../../modules/platformSettings/runtime.js");
const platformSettingsMigration = require(
  "../../models/migrations/20260812100000-create-platform-settings.js"
);

describe("Platform settings API", () => {
  let app;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }
    app = await createTestAppWithPlatformSettingsRoutes();
    models = await getModels();
  });

  beforeEach(() => {
    setPlatformSettingOverrides({});
  });

  async function createSession(admin) {
    const user = await models.User.create(userFactory.build({ admin }));
    const token = generateTestToken({ id: user.id, email: user.email });
    return { user, headers: getAuthHeaders(token) };
  }

  it("returns only the safe registry to a platform admin", async () => {
    const session = await createSession(true);
    const response = await request(app)
      .get("/platform/settings")
      .set(session.headers)
      .expect(200);

    expect(response.body.version).toMatch(/^v?\d+\.\d+\.\d+/);
    expect(response.body.links.map((link) => link.id)).toEqual([
      "website", "github", "blog", "sponsors"
    ]);
    const keys = response.body.groups.flatMap((group) => (
      group.settings.map((setting) => setting.key)
    ));
    expect(keys).toContain("workspaceOrchestrator.enabled");
    expect(keys).toContain("workspaceOrchestrator.analysisDepth");
    expect(keys).not.toContain("workspaceOrchestrator.plannerModel");
    expect(keys).not.toContain("workspaceOrchestrator.maximumWorkersPerRequest");
    expect(keys).not.toContain("observations.llmAuditMode");
    expect(JSON.stringify(response.body)).not.toMatch(/api.?key|password|secret/i);
  });

  it("blocks users without the platform admin flag", async () => {
    const session = await createSession(false);
    const response = await request(app)
      .get("/platform/settings")
      .set(session.headers)
      .expect(403);
    expect(response.body.error).toMatch(/do not have access/i);
  });

  it("shows external data controls only when a provider is configured", async () => {
    const originalKey = process.env.CB_OPENAI_API_KEY_DEV;
    const session = await createSession(true);
    try {
      delete process.env.CB_OPENAI_API_KEY_DEV;
      const withoutProvider = await request(app)
        .get("/platform/settings")
        .set(session.headers)
        .expect(200);
      const keysWithoutProvider = withoutProvider.body.groups.flatMap((group) => (
        group.settings.map((setting) => setting.key)
      ));
      expect(keysWithoutProvider).not.toContain(
        "workspaceOrchestrator.externalWorkspaceContextEnabled"
      );

      process.env.CB_OPENAI_API_KEY_DEV = "test-provider-key";
      const withProvider = await request(app)
        .get("/platform/settings")
        .set(session.headers)
        .expect(200);
      const keysWithProvider = withProvider.body.groups.flatMap((group) => (
        group.settings.map((setting) => setting.key)
      ));
      expect(keysWithProvider).toContain(
        "workspaceOrchestrator.externalWorkspaceContextEnabled"
      );
      expect(JSON.stringify(withProvider.body)).not.toContain("test-provider-key");
      expect(JSON.stringify(withProvider.body)).not.toContain("requiresProvider");
    } finally {
      if (originalKey === undefined) delete process.env.CB_OPENAI_API_KEY_DEV;
      else process.env.CB_OPENAI_API_KEY_DEV = originalKey;
    }
  });

  it("saves validated overrides and restores deployment defaults", async () => {
    const session = await createSession(true);
    const updateResponse = await request(app)
      .put("/platform/settings")
      .set(session.headers)
      .send({
        settings: {
          "workspaceOrchestrator.enabled": false,
          "workspaceOrchestrator.maximumSummaryLookbackDays": 30,
          "workspaceOrchestrator.analysisDepth": "extended",
        },
      })
      .expect(200);

    const updatedSettings = updateResponse.body.groups.flatMap((group) => group.settings);
    expect(updatedSettings.find((setting) => (
      setting.key === "workspaceOrchestrator.enabled"
    ))).toMatchObject({ value: false, overridden: true });
    expect(getWorkspaceOrchestratorPolicy()).toMatchObject({
      enabled: false,
      maximumTotalToolCalls: 18,
      maximumSummaryLookbackDays: 30,
      maximumWorkersPerRequest: 4,
    });
    expect(await models.PlatformSetting.count()).toBe(3);

    const resetResponse = await request(app)
      .post("/platform/settings/reset")
      .set(session.headers)
      .send({ keys: ["workspaceOrchestrator.enabled"] })
      .expect(200);

    const resetSettings = resetResponse.body.groups.flatMap((group) => group.settings);
    expect(resetSettings.find((setting) => (
      setting.key === "workspaceOrchestrator.enabled"
    ))).toMatchObject({ value: true, overridden: false });
    expect(await models.PlatformSetting.count()).toBe(2);
  });

  it("rejects unknown and invalid settings", async () => {
    const session = await createSession(true);

    await request(app)
      .put("/platform/settings")
      .set(session.headers)
      .send({ settings: { "provider.apiKey": "do-not-store-this" } })
      .expect(400);

    await request(app)
      .put("/platform/settings")
      .set(session.headers)
      .send({ settings: { "workspaceOrchestrator.maximumModelTokensPerRequest": 9999 } })
      .expect(400);

    await request(app)
      .put("/platform/settings")
      .set(session.headers)
      .send({ settings: { "workspaceOrchestrator.analysisDepth": "unlimited" } })
      .expect(400);

    expect(await models.PlatformSetting.count()).toBe(0);
  });

  it("promotes the first existing user only when that user owns a team", async () => {
    const firstUser = await models.User.create(userFactory.build({ admin: false }));
    const secondUser = await models.User.create(userFactory.build({ admin: false }));
    const team = await models.Team.create({ name: "First team" });
    await models.TeamRole.create({
      user_id: firstUser.id,
      team_id: team.id,
      role: "teamOwner",
      canExport: true,
    });

    await platformSettingsMigration.up(models.sequelize.getQueryInterface());

    await firstUser.reload();
    await secondUser.reload();
    expect(firstUser.admin).toBe(true);
    expect(secondUser.admin).toBe(false);
  });

  it("does not promote a later owner when the first existing user is not an owner", async () => {
    const firstUser = await models.User.create(userFactory.build({ admin: false }));
    const secondUser = await models.User.create(userFactory.build({ admin: false }));
    const team = await models.Team.create({ name: "Later team" });
    await models.TeamRole.create({
      user_id: secondUser.id,
      team_id: team.id,
      role: "teamOwner",
      canExport: true,
    });

    await platformSettingsMigration.up(models.sequelize.getQueryInterface());

    await firstUser.reload();
    await secondUser.reload();
    expect(firstUser.admin).toBe(false);
    expect(secondUser.admin).toBe(false);
  });
});
