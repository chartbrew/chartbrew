import {
  beforeAll, describe, expect, it,
} from "vitest";
import request from "supertest";
import { createRequire } from "node:module";

import { createTestApp } from "../helpers/testApp.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { getModels } from "../helpers/dbHelpers.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { projectFactory } from "../factories/projectFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { userFactory } from "../factories/userFactory.js";

const require = createRequire(import.meta.url);
const {
  replaceAiConversationContext,
  validateAiContext,
} = require("../../modules/ai/contextAuthorization");

async function createAccess(models, role = "teamOwner", projects = null) {
  const user = await models.User.create(userFactory.build());
  const team = await models.Team.create(teamFactory.build());
  await models.TeamRole.create({
    projects,
    role,
    team_id: team.id,
    user_id: user.id,
  });
  const token = generateTestToken({
    email: user.email,
    id: user.id,
    name: user.name,
  });
  return { team, token, user };
}

function getAccess(seeded, overrides = {}) {
  return {
    allProjects: true,
    canConfigureTeam: true,
    projectIds: [],
    role: "teamOwner",
    teamId: seeded.team.id,
    userId: seeded.user.id,
    ...overrides,
  };
}

describe("AI conversation context", () => {
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    models = await getModels();
  });

  it("searches dashboards, charts, datasets, and connections with useful details", async () => {
    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const seeded = await createAccess(models);
    const project = await models.Project.create(projectFactory.build({
      name: "Sales overview",
      team_id: seeded.team.id,
    }));
    const chart = await models.Chart.create({
      name: "Weekly revenue",
      project_id: project.id,
      type: "bar",
    });
    const connection = await models.Connection.create({
      active: true,
      name: "Warehouse",
      subType: "PostgreSQL",
      team_id: seeded.team.id,
      type: "postgres",
    });
    const dataset = await models.Dataset.create({
      draft: false,
      name: "Revenue facts",
      project_ids: [project.id],
      team_id: seeded.team.id,
    });
    const dataRequest = await models.DataRequest.create({
      connection_id: connection.id,
      dataset_id: dataset.id,
    });
    await dataset.update({ main_dr_id: dataRequest.id });
    const otherTeam = await models.Team.create(teamFactory.build());
    await models.Project.create(projectFactory.build({
      name: "Other team dashboard",
      team_id: otherTeam.id,
    }));

    const response = await request(app)
      .get(`/ai/context?teamId=${seeded.team.id}&limit=30`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .expect(200);

    expect(response.body.context).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entity_type: "project",
        id: project.id,
        metadata: { canEdit: true, chartCount: 1 },
        name: "Sales overview",
      }),
      expect.objectContaining({
        entity_type: "chart",
        id: chart.id,
        metadata: expect.objectContaining({
          chartType: "bar",
          dashboardName: "Sales overview",
        }),
      }),
      expect.objectContaining({
        entity_type: "dataset",
        id: dataset.id,
        metadata: expect.objectContaining({
          connectionName: "Warehouse",
          sourceType: "PostgreSQL",
        }),
      }),
      expect.objectContaining({
        entity_type: "connection",
        id: connection.id,
      }),
    ]));
    expect(response.body.context.map((item) => item.name)).not.toContain("Other team dashboard");

    const searchResponse = await request(app)
      .get(`/ai/context?teamId=${seeded.team.id}&query=weekly`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .expect(200);
    expect(searchResponse.body.context).toEqual([
      expect.objectContaining({ entity_type: "chart", id: chart.id }),
    ]);
  });

  it("returns only context that a dashboard viewer can use", async () => {
    const owner = await createAccess(models);
    const visibleProject = await models.Project.create(projectFactory.build({
      name: "Visible dashboard",
      team_id: owner.team.id,
    }));
    const hiddenProject = await models.Project.create(projectFactory.build({
      name: "Hidden dashboard",
      team_id: owner.team.id,
    }));
    const viewer = await models.User.create(userFactory.build());
    await models.TeamRole.create({
      projects: [visibleProject.id],
      role: "projectViewer",
      team_id: owner.team.id,
      user_id: viewer.id,
    });
    const token = generateTestToken({ email: viewer.email, id: viewer.id, name: viewer.name });
    await models.Chart.bulkCreate([{
      name: "Visible chart",
      project_id: visibleProject.id,
      type: "line",
    }, {
      name: "Hidden chart",
      project_id: hiddenProject.id,
      type: "line",
    }]);
    await models.Dataset.bulkCreate([{
      draft: false,
      name: "Visible dataset",
      project_ids: [visibleProject.id],
      team_id: owner.team.id,
    }, {
      draft: false,
      name: "Hidden dataset",
      project_ids: [hiddenProject.id],
      team_id: owner.team.id,
    }], { individualHooks: true });
    await models.Connection.create({
      active: true,
      name: "Private connection",
      team_id: owner.team.id,
      type: "postgres",
    });

    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const response = await request(app)
      .get(`/ai/context?teamId=${owner.team.id}&limit=30`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const names = response.body.context.map((item) => item.name);

    expect(names).toEqual(expect.arrayContaining([
      "Visible dashboard",
      "Visible chart",
      "Visible dataset",
    ]));
    expect(names).not.toEqual(expect.arrayContaining([
      "Hidden dashboard",
      "Hidden chart",
      "Hidden dataset",
      "Private connection",
    ]));
    expect(response.body.context.find((item) => (
      item.entity_type === "project" && item.id === visibleProject.id
    ))).toEqual(
      expect.objectContaining({ metadata: expect.objectContaining({ canEdit: false }) })
    );
  });

  it("replaces and clears the active context set", async () => {
    const seeded = await createAccess(models);
    const project = await models.Project.create(projectFactory.build({ team_id: seeded.team.id }));
    const chart = await models.Chart.create({
      name: "Revenue",
      project_id: project.id,
      type: "line",
    });
    const conversation = await models.AiConversation.create({
      status: "active",
      team_id: seeded.team.id,
      title: "Context test",
      user_id: seeded.user.id,
    });
    const access = getAccess(seeded);
    const initial = await validateAiContext(access, [{ entity_type: "project", id: project.id }]);
    await replaceAiConversationContext(conversation.id, seeded.team.id, initial);
    const replacement = await validateAiContext(access, [{ entity_type: "chart", id: chart.id }]);
    await replaceAiConversationContext(conversation.id, seeded.team.id, replacement);

    await expect(models.AiConversationContext.findAll({
      raw: true,
      where: { conversation_id: conversation.id },
    })).resolves.toEqual([
      expect.objectContaining({ entity_id: `${chart.id}`, entity_type: "chart" }),
    ]);

    await replaceAiConversationContext(conversation.id, seeded.team.id, []);
    await expect(models.AiConversationContext.count({
      where: { conversation_id: conversation.id },
    })).resolves.toBe(0);
  });

  it("removes stored context after access is lost", async () => {
    const seeded = await createAccess(models, "projectViewer", []);
    const project = await models.Project.create(projectFactory.build({ team_id: seeded.team.id }));
    const teamRole = await models.TeamRole.findOne({
      where: { team_id: seeded.team.id, user_id: seeded.user.id },
    });
    await teamRole.update({ projects: [project.id] });
    const conversation = await models.AiConversation.create({
      status: "active",
      team_id: seeded.team.id,
      title: "Access test",
      user_id: seeded.user.id,
    });
    await models.AiConversationContext.create({
      conversation_id: conversation.id,
      entity_id: `${project.id}`,
      entity_type: "project",
      team_id: seeded.team.id,
    });
    await teamRole.update({ projects: [] });

    const app = await createTestApp();
    require("../../api/AiRoute.js")(app);
    const response = await request(app)
      .get(`/ai/conversations/${conversation.id}?teamId=${seeded.team.id}`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .expect(200);

    expect(response.body.conversation.context).toEqual([]);
    expect(response.body.conversation.contextNotice).toBe(
      "This item is no longer available. Select another item."
    );
    await expect(models.AiConversationContext.count({
      where: { conversation_id: conversation.id },
    })).resolves.toBe(0);
  });
});
