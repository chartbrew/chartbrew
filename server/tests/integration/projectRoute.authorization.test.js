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

  it("creates dashboard filters with stable ids and reorders the complete project list", async () => {
    const owner = await createOwnerProject(models, "OwnerFilterOrder");
    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";

    const firstResponse = await request(app)
      .post(`/project/${owner.project.id}/dashboard-filter`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        id: firstId,
        configuration: { type: "variable", variable: "currency", value: "gbp" },
        onReport: true,
      })
      .expect(200);
    const secondResponse = await request(app)
      .post(`/project/${owner.project.id}/dashboard-filter`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        id: secondId,
        configuration: { type: "field", field: "root[].country", value: "GB" },
        onReport: true,
      })
      .expect(200);

    expect(firstResponse.body).toMatchObject({ id: firstId, position: 0 });
    expect(secondResponse.body).toMatchObject({ id: secondId, position: 1 });

    const reorderResponse = await request(app)
      .put(`/project/${owner.project.id}/dashboard-filters/order`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ filterIds: [secondId, firstId] })
      .expect(200);

    expect(reorderResponse.body.map((filter) => filter.id)).toEqual([secondId, firstId]);
    expect(reorderResponse.body.map((filter) => filter.position)).toEqual([0, 1]);

    const projectResponse = await request(app)
      .get(`/project/${owner.project.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(projectResponse.body.DashboardFilters.map((filter) => filter.id)).toEqual([secondId, firstId]);

    await models.Chart.create({
      project_id: owner.project.id,
      name: "Public filter order chart",
      type: "bar",
      onReport: true,
    });
    const publicDashboardResponse = await request(app)
      .get(`/project/dashboard/${owner.project.brewName}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(publicDashboardResponse.body.DashboardFilters.map((filter) => filter.id)).toEqual([secondId, firstId]);
  });

  it("rejects reorder payloads containing filters from another project", async () => {
    const owner = await createOwnerProject(models, "OwnerFilterTenant");
    const other = await createOwnerProject(models, "OtherFilterTenant");
    const ownerFilter = await models.DashboardFilter.create({
      project_id: owner.project.id,
      configuration: { marker: "owner" },
      onReport: false,
      position: 0,
    });
    const otherFilter = await models.DashboardFilter.create({
      project_id: other.project.id,
      configuration: { marker: "other" },
      onReport: false,
      position: 0,
    });

    await request(app)
      .put(`/project/${owner.project.id}/dashboard-filters/order`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ filterIds: [otherFilter.id] })
      .expect(400);

    await ownerFilter.reload();
    expect(ownerFilter.position).toBe(0);
  });
});
