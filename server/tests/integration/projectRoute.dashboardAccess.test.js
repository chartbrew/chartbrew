import {
  beforeAll, describe, expect, it
} from "vitest";
import request from "supertest";
import { getLayouts, getReportOrder, breakpoints } from "../../../shared/dashboard/layout.mjs";
import bcrypt from "bcrypt";
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

function generateProjectShareToken(projectId, sharePolicyId) {
  return jwt.sign(
    { sub: { type: "Project", id: projectId, sharePolicyId } },
    process.env.CB_ENCRYPTION_KEY_DEV,
    { expiresIn: "1h" }
  );
}

async function seedDashboardAccessFixtures(models) {
  const user = await models.User.create(userFactory.build());
  const team = await models.Team.create(teamFactory.build());

  const allowedProject = await models.Project.create(projectFactory.build({
    team_id: team.id,
    ghost: false,
    public: false,
    brewName: "allowed-dashboard",
    passwordProtected: true,
    password: "allowed-secret",
  }));

  const restrictedProject = await models.Project.create(projectFactory.build({
    team_id: team.id,
    ghost: false,
    public: false,
    brewName: "restricted-dashboard",
    passwordProtected: true,
    password: "victim-secret",
  }));

  await models.TeamRole.create({
    team_id: team.id,
    user_id: user.id,
    role: "projectEditor",
    projects: [allowedProject.id],
  });

  await models.Chart.create({
    project_id: allowedProject.id,
    name: "Allowed Dashboard Chart",
    type: "line",
    draft: false,
    onReport: true,
  });

  await models.Chart.create({
    project_id: restrictedProject.id,
    name: "Restricted Dashboard Chart",
    type: "line",
    draft: false,
    onReport: true,
  });

  const token = generateTestToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  return {
    token,
    allowedProject,
    restrictedProject,
  };
}

async function seedReportChart(models, project) {
  return models.Chart.create({
    project_id: project.id,
    name: "Public Dashboard Chart",
    type: "line",
    draft: false,
    onReport: true,
  });
}

describe("ProjectRoute legacy dashboard access", () => {
  let app;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    app = await createTestApp();
    const projectRoute = require("../../api/ProjectRoute.js");
    projectRoute(app);
    models = await getModels();
  });

  it("limits layout saves to dashboard editors and returns the saved revision", async () => {
    const seeded = await seedDashboardAccessFixtures(models);
    const charts = await models.Chart.findAll({ where: { project_id: seeded.allowedProject.id } });
    const payload = { revision: 0, layouts: getLayouts(charts), order: getReportOrder(charts), custom: breakpoints };
    const forbidden = await request(app).put(`/project/${seeded.restrictedProject.id}/layout`)
      .set("Authorization", `Bearer ${seeded.token}`).send(payload);
    expect(forbidden.status).toBe(403);
    const saved = await request(app).put(`/project/${seeded.allowedProject.id}/layout`)
      .set("Authorization", `Bearer ${seeded.token}`).send(payload);
    expect(saved.status).toBe(200);
    expect(saved.body.layoutRevision).toBe(1);
    const stale = await request(app).put(`/project/${seeded.allowedProject.id}/layout`)
      .set("Authorization", `Bearer ${seeded.token}`).send(payload);
    expect(stale.status).toBe(409);
    await models.TeamRole.update({ role: "projectViewer" }, { where: { team_id: seeded.allowedProject.team_id } });
    const viewer = await request(app).put(`/project/${seeded.allowedProject.id}/layout`)
      .set("Authorization", `Bearer ${seeded.token}`).send({ ...payload, revision: 1 });
    expect(viewer.status).toBe(403);
  });

  it("blocks same-team users from reading a private dashboard outside their project scope", async () => {
    const seeded = await seedDashboardAccessFixtures(models);

    const response = await request(app)
      .get(`/project/dashboard/${seeded.restrictedProject.brewName}`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .expect(401);

    expect(response.text).toContain("Not authorized");
  });

  it("allows project members to use the legacy dashboard route without leaking the report password", async () => {
    const seeded = await seedDashboardAccessFixtures(models);

    const response = await request(app)
      .get(`/project/dashboard/${seeded.allowedProject.brewName}`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      id: seeded.allowedProject.id,
      brewName: seeded.allowedProject.brewName,
      password: "",
    }));
    expect(response.body.password).not.toBe("allowed-secret");
  });

  it("rate limits repeated public dashboard password attempts", async () => {
    const team = await models.Team.create(teamFactory.build());
    const project = await models.Project.create(projectFactory.build({
      team_id: team.id,
      ghost: false,
      public: true,
      brewName: "limited-dashboard",
      passwordProtected: true,
      password: "limited-secret",
    }));
    await seedReportChart(models, project);

    for (let index = 0; index < 5; index += 1) {
      await request(app)
        .get(`/project/dashboard/${project.brewName}`)
        .set("X-Forwarded-For", "198.51.100.10")
        .query({ pass: `wrong-${index}` })
        .expect(403);
    }

    await request(app)
      .get(`/project/dashboard/${project.brewName}`)
      .set("X-Forwarded-For", "198.51.100.10")
      .query({ pass: "wrong-6" })
      .expect(429);
  });

  it("rate limits repeated public report password attempts", async () => {
    const team = await models.Team.create(teamFactory.build());
    const project = await models.Project.create(projectFactory.build({
      team_id: team.id,
      ghost: false,
      public: true,
      brewName: "limited-report",
      passwordProtected: true,
      password: "limited-secret",
    }));
    await seedReportChart(models, project);
    const sharePolicy = await models.SharePolicy.create({
      entity_type: "Project",
      entity_id: project.id,
      visibility: "private",
    });
    const token = generateProjectShareToken(project.id, sharePolicy.id);

    for (let index = 0; index < 5; index += 1) {
      await request(app)
        .get(`/project/${project.brewName}/report`)
        .set("X-Forwarded-For", "198.51.100.11")
        .set("pass", `wrong-${index}`)
        .query({ token })
        .expect(403);
    }

    await request(app)
      .get(`/project/${project.brewName}/report`)
      .set("X-Forwarded-For", "198.51.100.11")
      .set("pass", "wrong-6")
      .query({ token })
      .expect(429);
  });

  it("does not expose legacy chart data in public report payloads", async () => {
    const team = await models.Team.create(teamFactory.build());
    const project = await models.Project.create(projectFactory.build({
      team_id: team.id,
      ghost: false,
      public: true,
      brewName: "generated-series-report",
      passwordProtected: false,
    }));
    await seedReportChart(models, project);
    const sharePolicy = await models.SharePolicy.create({
      entity_type: "Project",
      entity_id: project.id,
      visibility: "private",
    });
    const token = generateProjectShareToken(project.id, sharePolicy.id);

    const response = await request(app)
      .get(`/project/${project.brewName}/report`)
      .query({ token })
      .expect(200);

    const reportChart = response.body.Charts.find((chart) => chart.name === "Public Dashboard Chart");
    expect(reportChart).not.toHaveProperty("chartData");
    expect(reportChart.render).toBeNull();
  });

  it("stores public dashboard passwords as bcrypt hashes and accepts the raw password", async () => {
    const team = await models.Team.create(teamFactory.build());
    const project = await models.Project.create(projectFactory.build({
      team_id: team.id,
      ghost: false,
      public: true,
      brewName: "hashed-dashboard",
      passwordProtected: true,
      password: "hashed-secret",
    }));
    await seedReportChart(models, project);

    const storedProject = await models.Project.findByPk(project.id);
    expect(storedProject.password).not.toBe("hashed-secret");
    await expect(bcrypt.compare("hashed-secret", storedProject.password)).resolves.toBe(true);

    const response = await request(app)
      .get(`/project/dashboard/${project.brewName}`)
      .query({ pass: "hashed-secret" })
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      id: project.id,
      brewName: project.brewName,
      password: "",
    }));
  });

  it("does not generate a hidden password when enabling password protection", async () => {
    const user = await models.User.create(userFactory.build());
    const team = await models.Team.create(teamFactory.build());
    const project = await models.Project.create(projectFactory.build({
      team_id: team.id,
      ghost: false,
      public: true,
      brewName: "password-toggle",
      passwordProtected: false,
      password: null,
    }));
    await models.TeamRole.create({
      team_id: team.id,
      user_id: user.id,
      role: "teamOwner",
      projects: [project.id],
    });
    const token = generateTestToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    const response = await request(app)
      .put(`/project/${project.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ passwordProtected: true })
      .expect(200);

    expect(response.body.passwordProtected).toBe(true);
    expect(response.body.password).toBeNull();

    const storedProject = await models.Project.findByPk(project.id);
    expect(storedProject.password).toBeNull();
  });
});
