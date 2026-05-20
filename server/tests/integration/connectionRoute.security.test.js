import {
  beforeAll, beforeEach, describe, expect, it, vi
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
import { connectionFactory } from "../factories/connectionFactory.js";

const require = createRequire(import.meta.url);
const ConnectionController = require("../../controllers/ConnectionController.js");
const CustomerioConnection = require("../../sources/plugins/customerio/customerio.connection.js");
const { getSourceById } = require("../../sources");

async function seedProjectScopedAccess(models) {
  const user = await models.User.create(userFactory.build());
  const team = await models.Team.create(teamFactory.build());
  const allowedProject = await models.Project.create(projectFactory.build({
    team_id: team.id,
    ghost: false,
  }));
  const restrictedProject = await models.Project.create(projectFactory.build({
    team_id: team.id,
    ghost: false,
  }));

  await models.TeamRole.create({
    team_id: team.id,
    user_id: user.id,
    role: "projectEditor",
    projects: [allowedProject.id],
  });

  const allowedCustomerioConnection = await models.Connection.create(connectionFactory.build({
    team_id: team.id,
    project_ids: [allowedProject.id],
    type: "customerio",
    subType: "customerio",
    host: "us",
    password: "allowed-token",
  }));

  const restrictedCustomerioConnection = await models.Connection.create(connectionFactory.build({
    team_id: team.id,
    project_ids: [restrictedProject.id],
    type: "customerio",
    subType: "customerio",
    host: "us",
    password: "restricted-token",
  }));

  const allowedApiConnection = await models.Connection.create(connectionFactory.build({
    team_id: team.id,
    project_ids: [allowedProject.id],
    type: "api",
    subType: "rest",
    host: "https://allowed.example.com",
    options: JSON.stringify([{ Authorization: "Bearer allowed-api-token" }]),
  }));

  const allowedStripeConnection = await models.Connection.create(connectionFactory.build({
    team_id: team.id,
    project_ids: [allowedProject.id],
    type: "api",
    subType: "stripe",
    host: "https://api.stripe.com/v1",
    options: JSON.stringify([{ Authorization: "Bearer allowed-stripe-token" }]),
  }));

  const allowedStrapiConnection = await models.Connection.create(connectionFactory.build({
    team_id: team.id,
    project_ids: [allowedProject.id],
    type: "api",
    subType: "strapi",
    host: "https://cms.example.com/api",
    options: JSON.stringify([{ Authorization: "Bearer allowed-strapi-token" }]),
  }));

  const allowedMongoConnection = await models.Connection.create(connectionFactory.buildMongoDB({
    team_id: team.id,
    project_ids: [allowedProject.id],
    subType: "mongodb",
    connectionString: "mongodb://user:pass@mongo.example.com:27017/app",
  }));

  const allowedJiraConnection = await models.Connection.create(connectionFactory.build({
    team_id: team.id,
    project_ids: [allowedProject.id],
    type: "jira",
    subType: "jira",
    host: "https://chartbrew.atlassian.net",
    authentication: JSON.stringify({
      type: "api_token",
      email: "raz@example.com",
      apiToken: "jira-token",
    }),
  }));

  const restrictedApiConnection = await models.Connection.create(connectionFactory.build({
    team_id: team.id,
    project_ids: [restrictedProject.id],
    type: "api",
    subType: "rest",
    host: "https://restricted.example.com",
    options: JSON.stringify([{ Authorization: "Bearer restricted-api-token" }]),
  }));

  return {
    team,
    user,
    token: generateTestToken({
      id: user.id,
      email: user.email,
      name: user.name,
    }),
    connections: {
      allowedCustomerioConnection,
      restrictedCustomerioConnection,
      allowedApiConnection,
      allowedStripeConnection,
      allowedStrapiConnection,
      allowedMongoConnection,
      allowedJiraConnection,
      restrictedApiConnection,
    },
  };
}

describe("ConnectionRoute project scoping", () => {
  let app;
  let models;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) {
      await testDbManager.start();
    }

    app = await createTestApp();
    const connectionRoute = require("../../api/ConnectionRoute.js");
    connectionRoute(app);
    models = await getModels();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("CB_DISABLED_SERVER_SOURCES", "");
  });

  it("allows source actions for connections assigned to the caller's project", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const actionSpy = vi.spyOn(CustomerioConnection, "getAllSegments")
      .mockResolvedValue({ ok: true });

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.allowedCustomerioConnection.id}/source-action`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({ action: "getAllSegments" })
      .expect(200);

    expect(response.body).toEqual({ ok: true });
    expect(actionSpy).toHaveBeenCalledWith(expect.objectContaining({
      id: seeded.connections.allowedCustomerioConnection.id,
    }));
  });

  it("rejects source actions that are not exposed by the source plugin", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const internalSpy = vi.spyOn(CustomerioConnection, "getConnectionOpt");

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.allowedCustomerioConnection.id}/source-action`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        action: "getConnectionOpt",
        params: { method: "GET", route: "segments?limit=1" },
      })
      .expect(400);

    expect(response.body).toEqual({ error: "Unsupported source action" });
    expect(internalSpy).not.toHaveBeenCalled();
  });

  it("allows Jira source actions for connections assigned to the caller's project", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const jiraSource = getSourceById("jira");
    const actionSpy = vi.spyOn(jiraSource.backend.actions, "listProjects")
      .mockResolvedValue([{ id: "10000", key: "CHART", name: "Chartbrew" }]);

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.allowedJiraConnection.id}/source-action`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({ action: "listProjects" })
      .expect(200);

    expect(response.body).toEqual([{ id: "10000", key: "CHART", name: "Chartbrew" }]);
    expect(actionSpy).toHaveBeenCalledWith(expect.objectContaining({
      connection: expect.objectContaining({
        id: seeded.connections.allowedJiraConnection.id,
        type: "jira",
      }),
      params: {},
    }));
  });

  it("rejects source actions for same-team connections outside the caller's projects", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const actionSpy = vi.spyOn(CustomerioConnection, "getAllSegments")
      .mockResolvedValue({ ok: true });

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.restrictedCustomerioConnection.id}/source-action`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({ action: "getAllSegments" })
      .expect(403);

    expect(response.body).toEqual({ error: "Not authorized" });
    expect(actionSpy).not.toHaveBeenCalled();
  });

  it("runs apiTest through the generic API source preview hook", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const apiSource = getSourceById("api");
    const previewSpy = vi.spyOn(apiSource.backend, "previewDataRequest")
      .mockResolvedValue({ responseData: { data: [{ id: 1 }] } });
    const apiTestSpy = vi.spyOn(ConnectionController.prototype, "testApiRequest");

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.allowedApiConnection.id}/apiTest`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        dataRequest: {
          route: "/v1/customers?limit=5",
          method: "GET",
          useGlobalHeaders: true,
        },
      })
      .expect(200);

    expect(response.body).toEqual({ responseData: { data: [{ id: 1 }] } });
    expect(previewSpy).toHaveBeenCalledWith(expect.objectContaining({
      connection: expect.objectContaining({
        id: seeded.connections.allowedApiConnection.id,
        type: "api",
      }),
      dataRequest: {
        route: "/v1/customers?limit=5",
        method: "GET",
        useGlobalHeaders: true,
      },
    }));
    expect(apiTestSpy).not.toHaveBeenCalled();
  });

  it("runs apiTest through source preview hooks for migrated API sources", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const stripeSource = getSourceById("stripe");
    const previewSpy = vi.spyOn(stripeSource.backend, "previewDataRequest")
      .mockResolvedValue({ responseData: { data: [{ id: "txn_1" }] } });
    const apiTestSpy = vi.spyOn(ConnectionController.prototype, "testApiRequest");

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.allowedStripeConnection.id}/apiTest`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        dataRequest: {
          route: "/charges?limit=5",
          method: "GET",
          useGlobalHeaders: true,
        },
        itemsLimit: 100,
        items: "data",
        offset: "starting_after",
        pagination: true,
      })
      .expect(200);

    expect(response.body).toEqual({ responseData: { data: [{ id: "txn_1" }] } });
    expect(previewSpy).toHaveBeenCalledWith(expect.objectContaining({
      connection: expect.objectContaining({
        id: seeded.connections.allowedStripeConnection.id,
        subType: "stripe",
      }),
      dataRequest: {
        route: "/charges?limit=5",
        method: "GET",
        useGlobalHeaders: true,
      },
    }));
    expect(apiTestSpy).not.toHaveBeenCalled();
  });

  it("rejects apiTest for server-disabled source plugins", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const stripeSource = getSourceById("stripe");
    const previewSpy = vi.spyOn(stripeSource.backend, "previewDataRequest")
      .mockResolvedValue({ responseData: { data: [{ id: "txn_1" }] } });
    const apiTestSpy = vi.spyOn(ConnectionController.prototype, "testApiRequest");

    vi.stubEnv("CB_DISABLED_SERVER_SOURCES", "stripe");

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.allowedStripeConnection.id}/apiTest`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        dataRequest: {
          method: "GET",
          route: "/balance_transactions",
        },
        itemsLimit: 10,
        items: "data",
        pagination: true,
      })
      .expect(400);

    expect(response.body).toEqual({
      code: "SOURCE_DISABLED",
      sourceId: "stripe",
      message: "Stripe Legacy is disabled on this server.",
    });
    expect(previewSpy).not.toHaveBeenCalled();
    expect(apiTestSpy).not.toHaveBeenCalled();
  });

  it("runs apiTest through the Strapi source preview hook", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const strapiSource = getSourceById("strapi");
    const previewSpy = vi.spyOn(strapiSource.backend, "previewDataRequest")
      .mockResolvedValue({ responseData: { data: [{ id: 1, title: "Post" }] } });
    const apiTestSpy = vi.spyOn(ConnectionController.prototype, "testApiRequest");

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.allowedStrapiConnection.id}/apiTest`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        dataRequest: {
          route: "/posts?pagination[pageSize]=5",
          method: "GET",
          useGlobalHeaders: true,
        },
      })
      .expect(200);

    expect(response.body).toEqual({ responseData: { data: [{ id: 1, title: "Post" }] } });
    expect(previewSpy).toHaveBeenCalledWith(expect.objectContaining({
      connection: expect.objectContaining({
        id: seeded.connections.allowedStrapiConnection.id,
        subType: "strapi",
      }),
      dataRequest: {
        route: "/posts?pagination[pageSize]=5",
        method: "GET",
        useGlobalHeaders: true,
      },
    }));
    expect(apiTestSpy).not.toHaveBeenCalled();
  });

  it("runs apiTest through the MongoDB source preview hook", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const mongoSource = getSourceById("mongodb");
    const previewSpy = vi.spyOn(mongoSource.backend, "previewDataRequest")
      .mockResolvedValue({ responseData: { data: [{ total: 12 }] } });
    const apiTestSpy = vi.spyOn(ConnectionController.prototype, "testApiRequest");

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.allowedMongoConnection.id}/apiTest`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        dataRequest: {
          query: "collection('users').countDocuments({})",
        },
      })
      .expect(200);

    expect(response.body).toEqual({ responseData: { data: [{ total: 12 }] } });
    expect(previewSpy).toHaveBeenCalledWith(expect.objectContaining({
      connection: expect.objectContaining({
        id: seeded.connections.allowedMongoConnection.id,
        type: "mongodb",
      }),
      dataRequest: {
        query: "collection('users').countDocuments({})",
      },
    }));
    expect(apiTestSpy).not.toHaveBeenCalled();
  });

  it("uses the connection test route type when the MongoDB payload omits type", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const mongoSource = getSourceById("mongodb");
    const testSpy = vi.spyOn(mongoSource.backend, "testUnsavedConnection")
      .mockResolvedValue({ success: true, collections: [] });

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/mongodb/test`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        connectionString: "mongodb://user:pass@mongo.example.com:27017/app",
      })
      .expect(200);

    expect(response.body).toEqual({ success: true, collections: [] });
    expect(testSpy).toHaveBeenCalledWith(expect.objectContaining({
      connection: expect.objectContaining({
        type: "mongodb",
        connectionString: "mongodb://user:pass@mongo.example.com:27017/app",
      }),
    }));
  });

  it("rejects apiTest for same-team connections outside the caller's projects", async () => {
    const seeded = await seedProjectScopedAccess(models);
    const apiTestSpy = vi.spyOn(ConnectionController.prototype, "testApiRequest")
      .mockResolvedValue({ responseData: { data: [{ id: 1 }] } });

    const response = await request(app)
      .post(`/team/${seeded.team.id}/connections/${seeded.connections.restrictedApiConnection.id}/apiTest`)
      .set("Authorization", `Bearer ${seeded.token}`)
      .send({
        dataRequest: {
          route: "/v1/customers?limit=5",
          method: "GET",
          useGlobalHeaders: true,
        },
      })
      .expect(403);

    expect(response.body).toEqual({ error: "Not authorized" });
    expect(apiTestSpy).not.toHaveBeenCalled();
  });
});
