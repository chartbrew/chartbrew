import {
  beforeAll, describe, expect, it,
} from "vitest";
import request from "supertest";
import { createRequire } from "module";

import { createTestApp } from "../helpers/testApp.js";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { userFactory } from "../factories/userFactory.js";
import { teamFactory } from "../factories/teamFactory.js";
import { projectFactory } from "../factories/projectFactory.js";
import { connectionFactory } from "../factories/connectionFactory.js";

const require = createRequire(import.meta.url);

async function seedStripeTemplateSetup(models) {
  const user = await models.User.create(userFactory.build());
  const team = await models.Team.create(teamFactory.build());
  const project = await models.Project.create(projectFactory.build({
    team_id: team.id,
    ghost: false,
  }));

  await models.TeamRole.create({
    team_id: team.id,
    user_id: user.id,
    role: "teamOwner",
    projects: [project.id],
  });

  const connection = await models.Connection.create(connectionFactory.build({
    team_id: team.id,
    project_ids: [],
    type: "api",
    subType: "stripe",
    host: "https://api.stripe.com/v1",
    authentication: {
      type: "basic_auth",
      user: "sk_test_123",
      pass: "",
    },
    options: [],
  }));

  const token = generateTestToken({
    id: user.id,
    email: user.email,
    name: user.name,
  });

  return {
    user,
    team,
    project,
    connection,
    token,
  };
}

async function seedJiraTemplateSetup(models) {
  const seeded = await seedStripeTemplateSetup(models);
  const connection = await models.Connection.create(connectionFactory.build({
    team_id: seeded.team.id,
    project_ids: [],
    type: "jira",
    subType: "jira",
    host: "https://chartbrew.atlassian.net",
    authentication: {
      type: "api_token",
      email: "raz@example.com",
      apiToken: "token",
    },
    options: {
      jira: {
        siteUrl: "https://chartbrew.atlassian.net",
      },
    },
  }));

  return {
    ...seeded,
    connection,
  };
}

describe("ChartTemplateRoute", () => {
  let app;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    app = await createTestApp();
    const chartTemplateRoute = require("../../api/ChartTemplateRoute.js");
    chartTemplateRoute(app);
    models = await getModels();
  });

  it("lists built-in Stripe templates", async () => {
    const seeded = await seedStripeTemplateSetup(models);

    const response = await request(app)
      .get(`/team/${seeded.team.id}/chart-templates?source=stripe`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .expect(200);

    expect(response.body[0].slug).toBe("core-revenue");
    expect(response.body[0].datasets.length).toBeGreaterThan(0);
    expect(response.body[0].charts.length).toBeGreaterThan(0);
  });

  it("lists all built-in templates with connection requirements", async () => {
    const seeded = await seedStripeTemplateSetup(models);

    const response = await request(app)
      .get(`/team/${seeded.team.id}/chart-templates`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .expect(200);

    expect(response.body.some((template) => template.slug === "core-revenue")).toBe(true);
    expect(response.body[0].requiredConnection).toEqual(expect.objectContaining({
      type: expect.any(String),
      subType: expect.any(String),
    }));
  });

  it("creates selected datasets and charts in an existing dashboard", async () => {
    const seeded = await seedStripeTemplateSetup(models);

    const response = await request(app)
      .post(`/team/${seeded.team.id}/chart-templates/stripe/core-revenue/create`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        connection_id: seeded.connection.id,
        dashboard: { type: "existing", project_id: seeded.project.id },
        dataset_template_ids: ["payment_intents", "customers"],
        chart_template_ids: ["payment-volume", "new-customers"],
      })
      .expect(200);

    expect(response.body.project_id).toBe(seeded.project.id);
    expect(response.body.datasets).toHaveLength(2);
    expect(response.body.charts).toHaveLength(2);

    const datasets = await models.Dataset.findAll({
      where: { team_id: seeded.team.id },
      include: [{ model: models.DataRequest }],
    });
    const charts = await models.Chart.findAll({
      where: { project_id: seeded.project.id },
      include: [{ model: models.ChartDatasetConfig }],
    });
    const refreshedConnection = await models.Connection.findByPk(seeded.connection.id);

    expect(datasets).toHaveLength(2);
    expect(datasets[0].project_ids).toEqual([seeded.project.id]);
    expect(datasets[0].DataRequests[0].template).toBe("stripe");
    expect(datasets[0].DataRequests[0].offset).toBe("starting_after");
    expect(charts).toHaveLength(2);
    expect(charts[0].ChartDatasetConfigs).toHaveLength(1);
    expect(refreshedConnection.project_ids).toEqual([seeded.project.id]);
  });

  it("creates a new dashboard destination", async () => {
    const seeded = await seedStripeTemplateSetup(models);

    const response = await request(app)
      .post(`/team/${seeded.team.id}/chart-templates/stripe/core-revenue/create`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        connection_id: seeded.connection.id,
        dashboard: { type: "new", name: "Stripe Revenue" },
        dataset_template_ids: ["customers"],
        chart_template_ids: ["new-customers"],
      })
      .expect(200);

    const project = await models.Project.findByPk(response.body.project_id);
    const teamRole = await models.TeamRole.findOne({
      where: { team_id: seeded.team.id, user_id: seeded.user.id },
    });

    expect(project.name).toBe("Stripe Revenue");
    expect(teamRole.projects).toContain(project.id);
    expect(response.body.datasets).toHaveLength(1);
    expect(response.body.charts).toHaveLength(1);
  });

  it("creates datasets without charts", async () => {
    const seeded = await seedStripeTemplateSetup(models);

    const response = await request(app)
      .post(`/team/${seeded.team.id}/chart-templates/stripe/core-revenue/create`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        connection_id: seeded.connection.id,
        dashboard: { type: "existing", project_id: seeded.project.id },
        dataset_template_ids: ["customers", "subscriptions"],
        chart_template_ids: [],
      })
      .expect(200);

    const datasets = await models.Dataset.findAll({
      where: { team_id: seeded.team.id },
      include: [{ model: models.DataRequest }],
    });
    const charts = await models.Chart.findAll({
      where: { project_id: seeded.project.id },
    });

    expect(response.body.project_id).toBe(seeded.project.id);
    expect(response.body.datasets).toHaveLength(2);
    expect(response.body.charts).toHaveLength(0);
    expect(datasets).toHaveLength(2);
    expect(datasets[0].DataRequests[0].template).toBe("stripe");
    expect(charts).toHaveLength(0);
  });

  it("applies template variable defaults when creating Jira datasets", async () => {
    const seeded = await seedJiraTemplateSetup(models);

    const response = await request(app)
      .post(`/team/${seeded.team.id}/chart-templates/jira/project-overview/create`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        connection_id: seeded.connection.id,
        dashboard: { type: "existing", project_id: seeded.project.id },
        dataset_template_ids: ["issues_by_status"],
        chart_template_ids: [],
        variable_defaults: {
          projects: "CHART",
        },
      })
      .expect(200);

    const dataRequest = await models.DataRequest.findOne({
      where: { dataset_id: response.body.datasets[0].id },
    });
    const projectBinding = await models.VariableBinding.findOne({
      where: {
        entity_type: "DataRequest",
        entity_id: `${dataRequest.id}`,
        name: "projects",
      },
    });

    expect(projectBinding.default_value).toBe("CHART");
    expect(projectBinding.required).toBe(true);
  });

  it("applies sprint and board defaults when creating Jira sprint datasets", async () => {
    const seeded = await seedJiraTemplateSetup(models);

    const response = await request(app)
      .post(`/team/${seeded.team.id}/chart-templates/jira/sprint-health/create`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        connection_id: seeded.connection.id,
        dashboard: { type: "existing", project_id: seeded.project.id },
        dataset_template_ids: ["sprint_summary"],
        chart_template_ids: [],
        variable_defaults: {
          sprint_id: "123",
          board_id: "77",
        },
      })
      .expect(200);

    const dataRequest = await models.DataRequest.findOne({
      where: { dataset_id: response.body.datasets[0].id },
    });
    const bindings = await models.VariableBinding.findAll({
      where: {
        entity_type: "DataRequest",
        entity_id: `${dataRequest.id}`,
      },
    });
    const bindingsByName = new Map(bindings.map((binding) => [binding.name, binding]));

    expect(dataRequest.configuration).toEqual(expect.objectContaining({
      sprintId: "{{sprint_id}}",
      boardId: "{{board_id}}",
    }));
    expect(bindingsByName.get("sprint_id")).toEqual(expect.objectContaining({
      default_value: "123",
      required: true,
    }));
    expect(bindingsByName.get("board_id")).toEqual(expect.objectContaining({
      default_value: "77",
      required: true,
    }));
  });

  it("creates Jira template charts with complete dataset config fields", async () => {
    const seeded = await seedJiraTemplateSetup(models);

    const response = await request(app)
      .post(`/team/${seeded.team.id}/chart-templates/jira/project-overview/create`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        connection_id: seeded.connection.id,
        dashboard: { type: "existing", project_id: seeded.project.id },
        dataset_template_ids: ["issues_by_status"],
        chart_template_ids: ["issues-by-status"],
        variable_defaults: {
          projects: "CHART",
        },
      })
      .expect(200);

    const chart = await models.Chart.findByPk(response.body.charts[0].id, {
      include: [{ model: models.ChartDatasetConfig }],
    });
    const dataset = await models.Dataset.findByPk(response.body.datasets[0].id);
    const [cdc] = chart.ChartDatasetConfigs;

    expect(cdc.xAxis).toBe("root[].status");
    expect(cdc.yAxis).toBe("root[].issueCount");
    expect(cdc.yAxisOperation).toBe("none");
    expect(dataset.fieldsSchema).toEqual(expect.objectContaining({
      "root[].status": "string",
      "root[].issueCount": "number",
    }));
  });

  it("rejects cross-team connections", async () => {
    const seeded = await seedStripeTemplateSetup(models);
    const otherTeam = await models.Team.create(teamFactory.build());
    const otherConnection = await models.Connection.create(connectionFactory.build({
      team_id: otherTeam.id,
      type: "api",
      subType: "stripe",
      host: "https://api.stripe.com/v1",
      authentication: {},
      options: [],
    }));

    await request(app)
      .post(`/team/${seeded.team.id}/chart-templates/stripe/core-revenue/create`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        connection_id: otherConnection.id,
        dashboard: { type: "existing", project_id: seeded.project.id },
        dataset_template_ids: ["customers"],
        chart_template_ids: ["new-customers"],
      })
      .expect(404);
  });

  it("rolls back rows when chart dependencies are invalid", async () => {
    const seeded = await seedStripeTemplateSetup(models);

    await request(app)
      .post(`/team/${seeded.team.id}/chart-templates/stripe/core-revenue/create`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        connection_id: seeded.connection.id,
        dashboard: { type: "existing", project_id: seeded.project.id },
        dataset_template_ids: ["customers"],
        chart_template_ids: ["payment-volume"],
      })
      .expect(400);

    const datasets = await models.Dataset.count({ where: { team_id: seeded.team.id } });
    const charts = await models.Chart.count({ where: { project_id: seeded.project.id } });

    expect(datasets).toBe(0);
    expect(charts).toBe(0);
  });
});
