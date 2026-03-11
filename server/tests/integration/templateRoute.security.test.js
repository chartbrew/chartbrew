import {
  beforeAll, beforeEach, describe, expect, it,
} from "vitest";
import { createRequire } from "module";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";
import { generateTestToken } from "../helpers/authHelpers.js";
import { teamFactory } from "../factories/teamFactory.js";
import { projectFactory } from "../factories/projectFactory.js";
import { userFactory } from "../factories/userFactory.js";

const require = createRequire(import.meta.url);

function createRouteRegistry() {
  const routes = new Map();

  const register = (method, path, handlers) => {
    routes.set(`${method} ${path}`, handlers);
  };

  return {
    app: {
      get(path, ...handlers) {
        register("GET", path, handlers);
      },
      post(path, ...handlers) {
        register("POST", path, handlers);
      },
      put(path, ...handlers) {
        register("PUT", path, handlers);
      },
      delete(path, ...handlers) {
        register("DELETE", path, handlers);
      },
    },
    getHandlers(method, path) {
      return routes.get(`${method} ${path}`) || [];
    },
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function executeRouteHandlers(handlers, requestOverrides = {}) {
  const req = {
    body: {},
    headers: {},
    params: {},
    query: {},
    ...requestOverrides,
  };
  const res = createMockResponse();

  const dispatch = async (index) => {
    if (index >= handlers.length) {
      return;
    }

    await handlers[index](req, res, (error) => {
      if (error) {
        return Promise.reject(error);
      }

      return dispatch(index + 1);
    });
  };

  await dispatch(0);

  return {
    req,
    res,
    statusCode: res.statusCode,
    body: res.body,
  };
}

function createAuthorizationHeader(token) {
  return {
    authorization: `Bearer ${token}`,
  };
}

async function createTemplateProject(models, {
  teamName,
  userEmail,
  projectName,
  brewName,
  marker,
}) {
  const user = await models.User.create(userFactory.build({
    email: userEmail,
  }));
  const team = await models.Team.create(teamFactory.build({
    name: teamName,
  }));
  const project = await models.Project.create(projectFactory.build({
    name: projectName,
    brewName,
    team_id: team.id,
    ghost: false,
  }));

  await models.TeamRole.create({
    user_id: user.id,
    team_id: team.id,
    role: "teamOwner",
  });

  const variable = await models.Variable.create({
    project_id: project.id,
    name: `${marker}_VAR`,
  });

  const chart = await models.Chart.create({
    project_id: project.id,
    name: `${marker} Chart`,
    type: "line",
    draft: false,
    onReport: true,
  });

  const connection = await models.Connection.create({
    team_id: team.id,
    project_ids: [project.id],
    name: `${marker} Connection`,
    type: "api",
    subType: "api",
    active: true,
    host: `http://${marker.toLowerCase()}.internal.example`,
    options: {},
    authentication: {},
  });

  const dataset = await models.Dataset.create({
    team_id: team.id,
    project_ids: [project.id],
    draft: false,
    legend: `${marker} Dataset`,
    xAxis: "items[].label",
    yAxis: "items[].value",
    fieldsSchema: {
      marker,
      value: "number",
    },
  });

  const dataRequest = await models.DataRequest.create({
    dataset_id: dataset.id,
    connection_id: connection.id,
    method: "GET",
    route: "/metrics",
    headers: {
      Authorization: `Bearer ${marker}-header-secret`,
    },
    body: `${marker}-body-secret`,
    query: "SELECT 1",
  });

  await dataset.update({
    main_dr_id: dataRequest.id,
  });

  await models.ChartDatasetConfig.create({
    chart_id: chart.id,
    dataset_id: dataset.id,
    legend: dataset.legend,
  });

  return {
    user,
    team,
    project,
    chart,
    connection,
    dataset,
    variable,
    secrets: {
      host: connection.host,
      header: `Bearer ${marker}-header-secret`,
      body: `${marker}-body-secret`,
      variable: variable.name,
    },
  };
}

describe("TemplateRoute security", () => {
  let generateRouteHandlers;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    const routeRegistry = createRouteRegistry();
    const templateRoute = require("../../api/TemplateRoute.js");
    templateRoute(routeRegistry.app);
    generateRouteHandlers = routeRegistry.getHandlers("GET", "/team/:team_id/template/generate/:project_id");
    models = await getModels();
  });

  beforeEach(async () => {
    await models.sequelize.sync({ force: true });
  });

  it("exports same-team templates without secret-bearing request fields", async () => {
    const ownerProject = await createTemplateProject(models, {
      teamName: "Owner Team",
      userEmail: "owner-template@example.com",
      projectName: "Owner Dashboard",
      brewName: "owner-dashboard",
      marker: "SAFE_MARKER_1773229449",
    });

    const ownerToken = generateTestToken({
      id: ownerProject.user.id,
      email: ownerProject.user.email,
      name: ownerProject.user.name,
    });

    const response = await executeRouteHandlers(generateRouteHandlers, {
      headers: createAuthorizationHeader(ownerToken),
      params: {
        team_id: String(ownerProject.team.id),
        project_id: String(ownerProject.project.id),
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.Charts).toHaveLength(1);
    expect(response.body.Charts[0]).toEqual(expect.objectContaining({
      name: ownerProject.chart.name,
      tid: 0,
    }));
    expect(response.body.Charts[0].ChartDatasetConfigs[0].dataset_id).toBe(ownerProject.dataset.id);
    expect(response.body.Charts[0].ChartDatasetConfigs[0].Dataset).toBeUndefined();

    expect(response.body.Datasets).toHaveLength(1);
    expect(response.body.Datasets[0].id).toBe(ownerProject.dataset.id);
    expect(response.body.Datasets[0].DataRequests).toBeUndefined();

    expect(response.body.Connections).toEqual([
      expect.objectContaining({
        id: ownerProject.connection.id,
        name: ownerProject.connection.name,
        type: ownerProject.connection.type,
        subType: ownerProject.connection.subType,
      }),
    ]);
    expect(response.body.Connections[0].host).toBeUndefined();

    const serializedBody = JSON.stringify(response.body);
    expect(serializedBody).toContain(ownerProject.chart.name);
    expect(serializedBody).toContain(ownerProject.secrets.variable);
    expect(serializedBody).not.toContain(ownerProject.secrets.host);
    expect(serializedBody).not.toContain(ownerProject.secrets.header);
    expect(serializedBody).not.toContain(ownerProject.secrets.body);
  });

  it("rejects cross-team template generation requests before returning victim data", async () => {
    const attackerProject = await createTemplateProject(models, {
      teamName: "Attacker Team",
      userEmail: "attacker-template@example.com",
      projectName: "Attacker Dashboard",
      brewName: "attacker-dashboard",
      marker: "ATTACKER_MARKER",
    });
    const victimProject = await createTemplateProject(models, {
      teamName: "Victim Team",
      userEmail: "victim-template@example.com",
      projectName: "Victim Dashboard",
      brewName: "victim-dashboard",
      marker: "VICTIM_MARKER_1773229449",
    });

    const attackerToken = generateTestToken({
      id: attackerProject.user.id,
      email: attackerProject.user.email,
      name: attackerProject.user.name,
    });

    const response = await executeRouteHandlers(generateRouteHandlers, {
      headers: createAuthorizationHeader(attackerToken),
      params: {
        team_id: String(attackerProject.team.id),
        project_id: String(victimProject.project.id),
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Not authorized" });

    const serializedBody = JSON.stringify(response.body);
    expect(serializedBody).not.toContain(victimProject.chart.name);
    expect(serializedBody).not.toContain(victimProject.secrets.variable);
    expect(serializedBody).not.toContain(victimProject.secrets.host);
    expect(serializedBody).not.toContain(victimProject.secrets.header);
    expect(serializedBody).not.toContain(victimProject.secrets.body);
  });
});
