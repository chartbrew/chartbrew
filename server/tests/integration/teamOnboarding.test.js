import {
  beforeAll, beforeEach, describe, expect, it,
} from "vitest";
import jwt from "jsonwebtoken";
import request from "supertest";

import { getModels } from "../helpers/dbHelpers.js";
import { createTestAppWithTeamRoutes } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("Team onboarding API", () => {
  let app;
  let models;
  let owner;
  let ownerToken;

  const createToken = (user) => {
    const settings = require("../../settings-dev");
    return jwt.sign({ id: user.id, email: user.email }, settings.encryptionKey, {
      expiresIn: "1h",
    });
  };

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    app = await createTestAppWithTeamRoutes();
    models = await getModels();
  });

  beforeEach(async () => {
    owner = await models.User.create({
      active: true,
      admin: false,
      email: "owner@example.com",
      name: "Team Owner",
      password: "unused",
    });
    ownerToken = createToken(owner);
  });

  async function createIncompleteTeam() {
    const response = await request(app)
      .post("/team")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        name: "New Team",
        onboardingCompletedAt: "2020-01-01T00:00:00.000Z",
        useCases: "internal",
      })
      .expect(200);
    return response.body;
  }

  it("allows an authenticated user to start website discovery before team creation", async () => {
    const response = await request(app)
      .post("/team/onboarding/discover")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ websiteUrl: "" })
      .expect(400);

    expect(response.body.error).toBe(
      "We could not read that website. Check the address or add the details yourself."
    );
  });

  it("creates the owner team and default projects in an incomplete state", async () => {
    const team = await createIncompleteTeam();
    expect(team.name).toBe("New Team");
    expect(team.useCases).toBe("internal");
    expect(team.onboardingCompletedAt).toBeNull();
    expect(team.TeamRoles).toEqual([
      expect.objectContaining({ role: "teamOwner", user_id: owner.id }),
    ]);
    const projects = await models.Project.findAll({ where: { team_id: team.id } });
    expect(projects).toHaveLength(2);
    expect(projects.some((project) => project.ghost)).toBe(true);
  });

  it("saves an approved profile and completes onboarding for the owner", async () => {
    const team = await createIncompleteTeam();
    const response = await request(app)
      .patch(`/team/${team.id}/onboarding`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        businessProfile: {
          businessName: "Acme",
          description: "Analytics for growing teams",
          domain: "acme.example",
          logo: { data: PNG.toString("base64"), mimeType: "image/png" },
          metadata: { industry: "Analytics", ignored: "raw" },
          websiteUrl: "https://acme.example",
        },
        complete: true,
      })
      .expect(200);
    expect(response.body.onboardingCompletedAt).toBeTruthy();
    expect(response.body.TeamBusinessProfile).toMatchObject({
      businessName: "Acme",
      domain: "acme.example",
      metadata: { industry: "Analytics" },
    });
    expect(response.body.TeamBusinessProfile).not.toHaveProperty("logoData");
    const logoResponse = await request(app)
      .get(`/team/${team.id}/business-profile/logo`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(logoResponse.headers["content-type"]).toContain("image/png");
    expect(logoResponse.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.compare(logoResponse.body, PNG)).toBe(0);
  });

  it("does not let a team admin complete onboarding and preserves an existing logo", async () => {
    const team = await createIncompleteTeam();
    await models.TeamBusinessProfile.create({
      businessName: "Original",
      logoData: PNG,
      logoMimeType: "image/png",
      team_id: team.id,
    });
    const admin = await models.User.create({
      active: true,
      email: "admin@example.com",
      name: "Team Admin",
      password: "unused",
    });
    await models.TeamRole.create({ team_id: team.id, user_id: admin.id, role: "teamAdmin" });
    const adminToken = createToken(admin);
    await request(app)
      .patch(`/team/${team.id}/onboarding`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ complete: true, aiEnabled: false, aiSuggestionsEnabled: false })
      .expect(403);
    expect((await models.Team.findByPk(team.id)).aiEnabled).toBe(true);
    await request(app)
      .put(`/team/${team.id}/business-profile`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        businessProfile: { businessName: "Updated by admin" },
      })
      .expect(200);
    const profile = await models.TeamBusinessProfile.findOne({ where: { team_id: team.id } });
    expect(profile.businessName).toBe("Updated by admin");
    expect(profile.logoMimeType).toBe("image/png");
    expect(Buffer.compare(profile.logoData, PNG)).toBe(0);
  });

  it("saves AI choices with onboarding and preserves them when omitted", async () => {
    const team = await createIncompleteTeam();
    const url = `/team/${team.id}/onboarding`;
    for (const settings of [
      { aiEnabled: false, aiSuggestionsEnabled: false },
      { aiEnabled: true, aiSuggestionsEnabled: false },
      { aiEnabled: false, aiSuggestionsEnabled: true },
    ]) {
      const response = await request(app).patch(url)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ ...settings, complete: true }).expect(200);
      expect(response.body).toMatchObject(settings);
      expect(response.body.onboardingCompletedAt).toBeTruthy();
    }
    const response = await request(app).patch(url)
      .set("Authorization", `Bearer ${ownerToken}`).send({ name: "Updated name" }).expect(200);
    expect(response.body).toMatchObject({ aiEnabled: false, aiSuggestionsEnabled: true });
  });

  it("rejects invalid AI choices without completing onboarding or saving partial changes", async () => {
    const team = await createIncompleteTeam();
    for (const settings of [{ aiEnabled: "false" }, { aiSuggestionsEnabled: null }, { aiEnabled: false, aiSuggestionsEnabled: 0 }]) {
      await request(app).patch(`/team/${team.id}/onboarding`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ ...settings, name: "Must not save", complete: true }).expect(400);
      const saved = await models.Team.findByPk(team.id);
      expect(saved.name).toBe("New Team");
      expect(saved.onboardingCompletedAt).toBeNull();
      expect(saved.aiEnabled).toBe(true);
      expect(saved.aiSuggestionsEnabled).toBe(true);
    }
  });

  it("saves preferences before completion and updates only the first dashboard", async () => {
    const team = await createIncompleteTeam();
    const projects = await models.Project.findAll({
      where: { team_id: team.id }, order: [["id", "ASC"]],
    });
    const extra = await models.Project.create({ team_id: team.id, name: "Keep timezone", timezone: "UTC" });
    const response = await request(app).patch(`/team/${team.id}/onboarding`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ timezone: "Asia/Bangkok", showBranding: false, complete: false }).expect(200);
    expect(response.body.showBranding).toBe(false);
    expect(response.body.onboardingCompletedAt).toBeNull();
    const first = projects.find((project) => !project.ghost);
    expect((await first.reload()).timezone).toBe("Asia/Bangkok");
    expect((await extra.reload()).timezone).toBe("UTC");
    const ghost = projects.find((project) => project.ghost);
    const ghostTimezone = ghost.timezone;
    expect((await ghost.reload()).timezone).toBe(ghostTimezone);
    const completed = await request(app).patch(`/team/${team.id}/onboarding`)
      .set("Authorization", `Bearer ${ownerToken}`).send({ complete: true }).expect(200);
    expect(completed.body.onboardingCompletedAt).toBeTruthy();
    expect(completed.body.showBranding).toBe(false);
  });

  it("rejects invalid preferences without saving partial changes", async () => {
    const team = await createIncompleteTeam();
    for (const settings of [
      { timezone: "Invalid/Timezone" }, { timezone: null }, { timezone: "" },
      { showBranding: "false", timezone: "UTC" },
    ]) {
      await request(app).patch(`/team/${team.id}/onboarding`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: "Must not save", complete: true, ...settings }).expect(400);
      const saved = await models.Team.findByPk(team.id);
      expect(saved.name).toBe("New Team");
      expect(saved.showBranding).toBe(true);
      expect(saved.onboardingCompletedAt).toBeNull();
    }
  });

  it("uses field allowlists for general team updates", async () => {
    const team = await createIncompleteTeam();
    await request(app)
      .put(`/team/${team.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        aiEnabled: false,
        name: "Renamed Team",
        onboardingCompletedAt: "2020-01-01T00:00:00.000Z",
      })
      .expect(200);
    const savedTeam = await models.Team.findByPk(team.id);
    expect(savedTeam.name).toBe("Renamed Team");
    expect(savedTeam.aiEnabled).toBe(false);
    expect(savedTeam.onboardingCompletedAt).toBeNull();
  });
});
