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

  return {
    app: {
      get(path, ...handlers) {
        routes.set(`GET ${path}`, handlers);
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

describe("Update Run audit API", () => {
  let listRouteHandlers;
  let detailRouteHandlers;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    const routeRegistry = createRouteRegistry();
    const updateRunRoute = require("../../api/UpdateRunRoute.js");
    updateRunRoute(routeRegistry.app);
    listRouteHandlers = routeRegistry.getHandlers("GET", "/team/:team_id/update-runs");
    detailRouteHandlers = routeRegistry.getHandlers("GET", "/team/:team_id/update-runs/:run_id");
    models = await getModels();
  });

  beforeEach(async () => {
    await models.sequelize.sync({ force: true });
  });

  it("allows team owners and admins to list filtered runs and fetch run detail", async () => {
    const owner = await models.User.create(userFactory.build({
      email: "audit-owner@example.com",
    }));
    const admin = await models.User.create(userFactory.build({
      email: "audit-admin@example.com",
    }));

    const team = await models.Team.create(teamFactory.build({
      name: "Audit Team",
    }));
    const project = await models.Project.create(projectFactory.build({
      name: "Audit Dashboard",
      brewName: "audit-dashboard",
      team_id: team.id,
    }));
    const otherTeam = await models.Team.create(teamFactory.build({
      name: "Other Team",
    }));
    const otherProject = await models.Project.create(projectFactory.build({
      name: "Other Dashboard",
      brewName: "other-dashboard",
      team_id: otherTeam.id,
    }));

    await models.TeamRole.bulkCreate([
      {
        user_id: owner.id,
        team_id: team.id,
        role: "teamOwner",
      },
      {
        user_id: admin.id,
        team_id: team.id,
        role: "teamAdmin",
      },
    ]);

    const rootRun = await models.UpdateRun.create({
      traceId: "trace-root",
      rootTraceId: "trace-root",
      triggerType: "chart_manual",
      entityType: "chart",
      teamId: team.id,
      projectId: project.id,
      chartId: 900,
      status: "success",
      startedAt: new Date(),
    });

    await models.UpdateRunEvent.create({
      runId: rootRun.id,
      sequence: 1,
      stage: "chart_loaded",
      status: "success",
      startedAt: new Date(),
      finishedAt: new Date(),
      durationMs: 10,
      payload: { chartId: 900 },
    });

    const childRun = await models.UpdateRun.create({
      traceId: "trace-child",
      rootTraceId: "trace-root",
      parentRunId: rootRun.id,
      triggerType: "chart_manual",
      entityType: "dataset_request",
      teamId: team.id,
      projectId: project.id,
      chartId: 900,
      datasetId: 501,
      dataRequestId: 601,
      connectionId: 701,
      status: "success",
      startedAt: new Date(),
    });

    await models.UpdateRun.create({
      traceId: "trace-other-team",
      rootTraceId: "trace-other-team",
      triggerType: "chart_manual",
      entityType: "chart",
      teamId: otherTeam.id,
      projectId: otherProject.id,
      chartId: 901,
      status: "success",
      startedAt: new Date(),
    });

    const ownerToken = generateTestToken({
      id: owner.id,
      email: owner.email,
      name: owner.name,
    });
    const adminToken = generateTestToken({
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });

    const listResponse = await executeRouteHandlers(listRouteHandlers, {
      headers: createAuthorizationHeader(ownerToken),
      params: { team_id: String(team.id) },
      query: { dataset_id: "501" },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(childRun.id);

    const detailResponse = await executeRouteHandlers(detailRouteHandlers, {
      headers: createAuthorizationHeader(adminToken),
      params: {
        team_id: String(team.id),
        run_id: String(rootRun.id),
      },
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.body.id).toBe(rootRun.id);
    expect(detailResponse.body.events).toHaveLength(1);
    expect(detailResponse.body.childRuns).toHaveLength(1);
    expect(detailResponse.body.childRuns[0].id).toBe(childRun.id);
  });

  it("returns 403 for non-admin team members", async () => {
    const member = await models.User.create(userFactory.build({
      email: "audit-member@example.com",
    }));
    const team = await models.Team.create(teamFactory.build({
      name: "Restricted Audit Team",
    }));
    const project = await models.Project.create(projectFactory.build({
      name: "Restricted Audit Dashboard",
      brewName: "restricted-audit-dashboard",
      team_id: team.id,
    }));

    await models.TeamRole.create({
      user_id: member.id,
      team_id: team.id,
      role: "member",
      projects: [project.id],
    });

    const run = await models.UpdateRun.create({
      traceId: "trace-member",
      rootTraceId: "trace-member",
      triggerType: "chart_manual",
      entityType: "chart",
      teamId: team.id,
      projectId: project.id,
      chartId: 902,
      status: "success",
      startedAt: new Date(),
    });

    const memberToken = generateTestToken({
      id: member.id,
      email: member.email,
      name: member.name,
    });

    const listResponse = await executeRouteHandlers(listRouteHandlers, {
      headers: createAuthorizationHeader(memberToken),
      params: { team_id: String(team.id) },
    });
    expect(listResponse.statusCode).toBe(403);

    const detailResponse = await executeRouteHandlers(detailRouteHandlers, {
      headers: createAuthorizationHeader(memberToken),
      params: {
        team_id: String(team.id),
        run_id: String(run.id),
      },
    });
    expect(detailResponse.statusCode).toBe(403);
  });
});
