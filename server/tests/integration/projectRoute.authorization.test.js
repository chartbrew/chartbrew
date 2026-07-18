import {
  beforeAll, describe, expect, it,
} from "vitest";
import request from "supertest";
import { createRequire } from "module";

import { createTestApp } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { userFactory } from "../factories/userFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { projectFactory } from "../factories/projectFactory.js";

const require = createRequire(import.meta.url);

async function createOwnerProject(models, marker) {
  const user = await models.User.create(userFactory.build({
    email: `${marker.toLowerCase()}@example.com`,
  }));
  const team = await models.Team.create(teamFactory.build({
    name: `${marker} Team`,
  }));
  const project = await models.Project.create(projectFactory.build({
    name: `${marker} Project`,
    brewName: `${marker.toLowerCase()}-project`,
    team_id: team.id,
    ghost: false,
  }));

  await models.TeamRole.create({
    user_id: user.id,
    team_id: team.id,
    role: "teamOwner",
    projects: [project.id],
  });

  return {
    user,
    team,
    project,
    token: generateTestToken({
      id: user.id,
      email: user.email,
      name: user.name,
    }),
  };
}

describe("ProjectRoute tenant authorization", () => {
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

  it("rejects cross-team project updates that supply the attacker's team in the body", async () => {
    const attacker = await createOwnerProject(models, "AttackerUpdate");
    const victim = await createOwnerProject(models, "VictimUpdate");

    await request(app)
      .put(`/project/${victim.project.id}`)
      .set("Authorization", `Bearer ${attacker.token}`)
      .send({
        team_id: attacker.team.id,
        public: true,
        passwordProtected: false,
        dashboardTitle: "Cross-tenant rewrite",
      })
      .expect(403);

    await victim.project.reload();
    expect(victim.project.team_id).toBe(victim.team.id);
    expect(victim.project.dashboardTitle).not.toBe("Cross-tenant rewrite");
  });

  it("rejects cross-team deletion even when the request body contains an allowed team", async () => {
    const attacker = await createOwnerProject(models, "AttackerDelete");
    const victim = await createOwnerProject(models, "VictimDelete");

    await request(app)
      .delete(`/project/${victim.project.id}`)
      .set("Authorization", `Bearer ${attacker.token}`)
      .send({ team_id: attacker.team.id })
      .expect(403);

    expect(await models.Project.findByPk(victim.project.id)).not.toBeNull();
  });

  it("updates an authorized project while ignoring attempts to change its team", async () => {
    const owner = await createOwnerProject(models, "OwnerUpdate");
    const other = await createOwnerProject(models, "OtherUpdate");

    const response = await request(app)
      .put(`/project/${owner.project.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "Updated project name",
        team_id: other.team.id,
      })
      .expect(200);

    expect(response.body.name).toBe("Updated project name");
    expect(response.body.team_id).toBe(owner.team.id);
  });

  it("continues accepting team_id when creating a project", async () => {
    const owner = await createOwnerProject(models, "OwnerCreate");

    const response = await request(app)
      .post("/project")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "New project",
        team_id: owner.team.id,
      })
      .expect(200);

    expect(response.body.team_id).toBe(owner.team.id);
  });

  it("binds variable writes to the authorized route project", async () => {
    const attacker = await createOwnerProject(models, "AttackerVariable");
    const victim = await createOwnerProject(models, "VictimVariable");
    const victimVariable = await models.Variable.create({
      project_id: victim.project.id,
      name: "Victim variable",
    });

    await request(app)
      .put(`/project/${attacker.project.id}/variables/${victimVariable.id}`)
      .set("Authorization", `Bearer ${attacker.token}`)
      .send({ name: "Rewritten variable" })
      .expect(404);

    const createResponse = await request(app)
      .post(`/project/${attacker.project.id}/variables`)
      .set("Authorization", `Bearer ${attacker.token}`)
      .send({
        name: "Attacker variable",
        project_id: victim.project.id,
      })
      .expect(200);

    await victimVariable.reload();
    expect(victimVariable.name).toBe("Victim variable");
    expect(createResponse.body.project_id).toBe(attacker.project.id);
  });

  it("binds dashboard-filter writes to the authorized route project", async () => {
    const attacker = await createOwnerProject(models, "AttackerFilter");
    const victim = await createOwnerProject(models, "VictimFilter");
    const victimFilter = await models.DashboardFilter.create({
      project_id: victim.project.id,
      configuration: { marker: "victim" },
      onReport: false,
    });

    await request(app)
      .put(`/project/${attacker.project.id}/dashboard-filter/${victimFilter.id}`)
      .set("Authorization", `Bearer ${attacker.token}`)
      .send({ onReport: true })
      .expect(404);

    await victimFilter.reload();
    expect(victimFilter.onReport).toBe(false);
  });
});
