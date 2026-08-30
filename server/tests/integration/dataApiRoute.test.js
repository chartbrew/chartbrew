import express from "express";
import { createRequire } from "module";
import request from "supertest";
import {
  afterEach, beforeAll, beforeEach, describe, expect, it, vi,
} from "vitest";

import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const require = createRequire(import.meta.url);

describe("Data API routes", () => {
  let app;
  let db;
  let getSourceById;
  let runtimeCache;
  let TeamController;
  let VisualizationEngine;

  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
    ({ getSourceById } = require("../../sources/index.js"));
    runtimeCache = require("../../modules/runtimeCache.js");
    TeamController = require("../../controllers/TeamController.js");
    ({ VisualizationEngine } = require("../../visualization/VisualizationEngine.js"));
  });

  beforeEach(async () => {
    await runtimeCache.resetForTests();
    app = express();
    app.set("trust proxy", 1);
    app.use(express.json({
      verify: (req, _res, buffer, encoding) => {
        req.rawBody = buffer.toString(encoding || "utf8");
      },
    }));
    app.use(require("../../modules/dataApiBodyError.js"));
    require("../../api/DataApiRoute.js")(app);
  });

  afterEach(() => {
    [
      "CB_DATA_API_AUTH_RATE_LIMIT_MAX",
      "CB_DATA_API_ENABLED",
      "CB_DATA_API_MAX_EXECUTION_MS",
      "CB_DATA_API_MAX_REQUEST_BYTES",
      "CB_DATA_API_MAX_RESPONSE_BYTES",
      "CB_DATA_API_RATE_LIMIT_MAX",
    ].forEach((key) => delete process.env[key]);
  });

  async function createFixture() {
    const team = await db.Team.create({ name: "Data API Team" });
    const user = await db.User.create({
      active: true,
      email: `data-api-${Date.now()}-${Math.random()}@example.com`,
      name: "Data API owner",
      password: "password",
      tutorials: {},
    });
    const project = await db.Project.create({
      brewName: `data-api-${Date.now()}-${Math.random()}`,
      ghost: false,
      name: "Data API Project",
      team_id: team.id,
      timezone: "Asia/Bangkok",
    });
    await db.TeamRole.create({
      projects: [project.id],
      role: "teamOwner",
      team_id: team.id,
      user_id: user.id,
    });
    const key = await new TeamController().createApiKey(team.id, user, {
      allProjects: false,
      name: "Data API key",
      projectIds: [project.id],
      scopes: ["data:read", "data:refresh"],
    });
    const connection = await db.Connection.create({
      host: "localhost",
      name: "Orders database",
      project_ids: [project.id],
      team_id: team.id,
      type: "postgres",
    });
    const dataset = await db.Dataset.create({
      conditions: [],
      draft: false,
      fieldsSchema: {
        "root[].amount": "number",
        "root[].customer.id": "number",
        "root[].customer.name": "string",
        "root[].customerId": "number",
        "root[].month": "string",
        "root[].status": "string",
      },
      name: "Orders",
      project_ids: [project.id],
      team_id: team.id,
    });
    const ordersRequest = await db.DataRequest.create({
      connection_id: connection.id,
      dataset_id: dataset.id,
      query: "select customer_id, month, amount, status from orders",
    });
    // The current test schema has a legacy DataRequest.id -> Dataset.id constraint.
    await db.Dataset.create({
      draft: true,
      name: "Join support",
      project_ids: [project.id],
      team_id: team.id,
    });
    const customersRequest = await db.DataRequest.create({
      connection_id: connection.id,
      dataset_id: dataset.id,
      query: "select id, name from customers",
    });
    await dataset.update({
      joinSettings: {
        joins: [{
          alias: "customer",
          dr_field: "root[].customerId",
          dr_id: ordersRequest.id,
          join_field: "root[].id",
          join_id: customersRequest.id,
        }],
      },
      main_dr_id: ordersRequest.id,
    });
    const chart = await db.Chart.create({
      draft: false,
      name: "Order totals",
      project_id: project.id,
      type: "bar",
    });
    const cdc = await db.ChartDatasetConfig.create({
      chart_id: chart.id,
      conditions: [],
      dataset_id: dataset.id,
      legend: "Order totals",
      xAxis: "root[].month",
      yAxis: "root[].amount",
      yAxisOperation: "none",
    });

    return {
      cdc, chart, connection, customersRequest, dataset, key, ordersRequest, project, team,
    };
  }

  function authorize(call, token) {
    return call.set("Authorization", `Bearer ${token}`).set("Accept", "application/json");
  }

  function mockOrderSource(fixture) {
    const orders = [
      { customerId: 10, month: "Jan", amount: 120, status: "paid" },
      { customerId: 11, month: "Feb", amount: 80, status: "pending" },
      { customerId: 10, month: "Mar", amount: 140, status: "paid" },
    ];
    const customers = [
      { id: 10, name: "Ada" },
      { id: 11, name: "Lin" },
    ];
    return vi.spyOn(getSourceById("postgres").backend, "runDataRequest")
      .mockImplementation(async ({ dataRequest }) => ({
        dataRequest,
        responseData: {
          data: dataRequest.id === fixture.ordersRequest.id ? orders : customers,
        },
      }));
  }

  it("returns exact joined dataset data and applies runtime filters after the join", async () => {
    const fixture = await createFixture();
    const sourceSpy = mockOrderSource(fixture);

    const defaultResponse = await authorize(
      request(app).get(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`),
      fixture.key.token
    );
    expect(defaultResponse.status).toBe(200);
    expect(defaultResponse.body.data).toEqual([
      {
        customerId: 10,
        month: "Jan",
        amount: 120,
        status: "paid",
        customer: { id: 10, name: "Ada" },
      },
      {
        customerId: 11,
        month: "Feb",
        amount: 80,
        status: "pending",
        customer: { id: 11, name: "Lin" },
      },
      {
        customerId: 10,
        month: "Mar",
        amount: 140,
        status: "paid",
        customer: { id: 10, name: "Ada" },
      },
    ]);
    expect(defaultResponse.body.resource).toEqual({
      id: fixture.dataset.id,
      kind: "dataset",
      name: "Orders",
    });
    expect(defaultResponse.headers.etag).toMatch(/^"dd-v1-[a-f0-9]{64}"$/);
    expect(defaultResponse.headers["x-chartbrew-data-stale"]).toBe("false");

    process.env.CB_DATA_API_MAX_RESPONSE_BYTES = "20";
    const conditionalResponse = await authorize(
      request(app)
        .get(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`)
        .set("If-None-Match", defaultResponse.headers.etag),
      fixture.key.token
    );
    expect(conditionalResponse.status).toBe(304);
    expect(conditionalResponse.text).toBe("");
    delete process.env.CB_DATA_API_MAX_RESPONSE_BYTES;

    const sourceCallsBeforeFilter = sourceSpy.mock.calls.length;
    const filteredResponse = await authorize(
      request(app)
        .post(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`)
        .send({
          filters: [{
            type: "field",
            field: "root[].customer.name",
            operator: "is",
            value: "Ada",
          }],
          timezone: "Asia/Bangkok",
        }),
      fixture.key.token
    );
    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body.data).toEqual([
      {
        customerId: 10,
        month: "Jan",
        amount: 120,
        status: "paid",
        customer: { id: 10, name: "Ada" },
      },
      {
        customerId: 10,
        month: "Mar",
        amount: 140,
        status: "paid",
        customer: { id: 10, name: "Ada" },
      },
    ]);
    expect(filteredResponse.headers["cache-control"]).toBe("private, no-store");
    sourceSpy.mock.calls.slice(sourceCallsBeforeFilter).forEach(([options]) => {
      expect(options.filters).toEqual([]);
    });

    sourceSpy.mockClear();
    const variableResponse = await authorize(
      request(app)
        .post(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`)
        .send({ variables: { region: "APAC" } }),
      fixture.key.token
    );
    expect(variableResponse.status).toBe(200);
    const variableSourceCalls = sourceSpy.mock.calls.length;
    const cachedVariableResponse = await authorize(
      request(app)
        .post(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`)
        .send({ variables: { region: "APAC" } }),
      fixture.key.token
    );
    expect(cachedVariableResponse.status).toBe(200);
    expect(cachedVariableResponse.body.data).toEqual(variableResponse.body.data);
    expect(sourceSpy).toHaveBeenCalledTimes(variableSourceCalls);
    expect(sourceSpy).toHaveBeenCalled();
    sourceSpy.mockRestore();
  });

  it("keeps dataset metadata unchanged for runtime POST requests", async () => {
    const fixture = await createFixture();
    const sourceSpy = mockOrderSource(fixture);
    await fixture.dataset.update({ fieldsSchema: {} });

    const response = await authorize(
      request(app)
        .post(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`)
        .send({ refresh: true }),
      fixture.key.token
    );
    expect(response.status).toBe(200);
    expect(response.body.fields.length).toBeGreaterThan(0);
    expect((await db.Dataset.findByPk(fixture.dataset.id)).fieldsSchema).toEqual({});
    sourceSpy.mockRestore();
  });

  it("returns exact transformed dataset data", async () => {
    const fixture = await createFixture();
    const transformed = await db.Dataset.create({
      draft: false,
      name: "Order items",
      project_ids: [fixture.project.id],
      team_id: fixture.team.id,
    });
    const dataRequest = await db.DataRequest.create({
      connection_id: fixture.connection.id,
      dataset_id: transformed.id,
      query: "select orders with items",
      transform: {
        enabled: true,
        type: "flattenNested",
        config: {
          baseArrayPath: "orders",
          nestedArrayPath: "items",
          outputFields: {
            orderId: { from: "base", path: "id" },
            sku: { from: "nested", path: "sku" },
            quantity: { from: "nested", path: "quantity" },
          },
        },
      },
    });
    await transformed.update({ main_dr_id: dataRequest.id });
    const sourceSpy = vi.spyOn(getSourceById("postgres").backend, "runDataRequest")
      .mockResolvedValue({
        dataRequest,
        responseData: {
          data: {
            orders: [
              { id: 1, items: [{ sku: "book", quantity: 2 }, { sku: "pen", quantity: 1 }] },
              { id: 2, items: [{ sku: "book", quantity: 3 }] },
            ],
          },
        },
      });

    const response = await authorize(
      request(app).get(`/api/v1/teams/${fixture.team.id}/datasets/${transformed.id}/data`),
      fixture.key.token
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      { orderId: 1, quantity: 2, sku: "book" },
      { orderId: 1, quantity: 1, sku: "pen" },
      { orderId: 2, quantity: 3, sku: "book" },
    ]);
    sourceSpy.mockRestore();
  });

  it("returns canonical chart rows without calling a renderer compiler", async () => {
    const fixture = await createFixture();
    const sourceSpy = mockOrderSource(fixture);
    const compilerSpy = vi.spyOn(VisualizationEngine.prototype, "compilePrepared");

    const response = await authorize(
      request(app).get(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`),
      fixture.key.token
    );
    expect(response.status).toBe(200);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].rows.map(({ category, value }) => ({ category, value })))
      .toEqual([
        { category: "Jan", value: 120 },
        { category: "Feb", value: 80 },
        { category: "Mar", value: 140 },
      ]);
    expect(response.body).not.toHaveProperty("configuration");
    expect(response.body).not.toHaveProperty("renderer");
    expect(compilerSpy).not.toHaveBeenCalled();

    const stored = await db.Chart.unscoped().findByPk(fixture.chart.id);
    expect(stored.preparedData.results[0].rows).toEqual(response.body.results[0].rows);

    sourceSpy.mockRejectedValue(new Error("The source is offline"));
    const snapshotResponse = await authorize(
      request(app)
        .get(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`)
        .set("If-None-Match", response.headers.etag),
      fixture.key.token
    );
    expect(snapshotResponse.status).toBe(304);
    expect(snapshotResponse.text).toBe("");
    expect(compilerSpy).not.toHaveBeenCalled();

    sourceSpy.mockClear();
    await fixture.ordersRequest.update({
      query: "select customer_id, month, amount, status from orders where active = true",
    });
    const staleResponse = await authorize(
      request(app).get(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`),
      fixture.key.token
    );
    expect(staleResponse.status).toBe(200);
    expect(staleResponse.headers["x-chartbrew-data-stale"]).toBe("true");
    expect(staleResponse.body.results[0].rows).toEqual(response.body.results[0].rows);
    await runtimeCache.runSingleFlight(
      `data-api-default-refresh:${fixture.chart.id}`,
      async () => null
    ).catch(() => null);
    expect(sourceSpy).toHaveBeenCalled();
    expect(compilerSpy).not.toHaveBeenCalled();
    compilerSpy.mockRestore();
    sourceSpy.mockRestore();
  });

  it("returns exact runtime chart rows and keeps runtime data out of the durable snapshot", async () => {
    const fixture = await createFixture();
    const sourceSpy = mockOrderSource(fixture);
    const compilerSpy = vi.spyOn(VisualizationEngine.prototype, "compilePrepared");

    const response = await authorize(
      request(app)
        .post(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`)
        .send({
          filters: [{
            type: "field",
            field: "root[].status",
            operator: "is",
            value: "paid",
            scope: "cdc",
            cdcId: fixture.cdc.id,
          }],
        }),
      fixture.key.token
    );
    expect(response.status).toBe(200);
    expect(response.body.results[0].rows.map(({ category, value }) => ({ category, value })))
      .toEqual([
        { category: "Jan", value: 120 },
        { category: "Mar", value: 140 },
      ]);
    expect(compilerSpy).not.toHaveBeenCalled();
    expect((await db.Chart.unscoped().findByPk(fixture.chart.id)).preparedData).toBeNull();

    const sourceCalls = sourceSpy.mock.calls.length;
    const cachedResponse = await authorize(
      request(app)
        .post(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`)
        .send({
          filters: [{
            type: "field",
            field: "root[].status",
            operator: "is",
            value: "paid",
            scope: "cdc",
            cdcId: fixture.cdc.id,
          }],
        }),
      fixture.key.token
    );
    expect(cachedResponse.status).toBe(200);
    expect(cachedResponse.body).toEqual(response.body);
    expect(sourceSpy).toHaveBeenCalledTimes(sourceCalls);
    compilerSpy.mockRestore();
    sourceSpy.mockRestore();
  });

  it("substitutes runtime variables without putting their names or values in audit records", async () => {
    const fixture = await createFixture();
    await fixture.ordersRequest.update({
      query: "select customer_id, month, amount, status from orders where region = '{{region}}'",
    });
    await db.VariableBinding.create({
      entity_id: `${fixture.ordersRequest.id}`,
      entity_type: "DataRequest",
      name: "region",
      required: false,
      type: "string",
    });
    const sourceSpy = mockOrderSource(fixture);

    const response = await authorize(
      request(app)
        .post(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`)
        .send({ variables: { region: "APAC" } }),
      fixture.key.token
    );
    expect(response.status).toBe(200);
    expect(response.body.results[0].rows.map(({ category, value }) => ({ category, value })))
      .toEqual([
        { category: "Jan", value: 120 },
        { category: "Feb", value: 80 },
        { category: "Mar", value: 140 },
      ]);
    expect(sourceSpy.mock.calls.some(([options]) => options.processedQuery?.includes("APAC")))
      .toBe(true);

    const runs = await db.UpdateRun.findAll({ where: { apiKeyId: fixture.key.id } });
    const events = await db.UpdateRunEvent.findAll({
      where: { runId: runs.map((run) => run.id) },
    });
    const auditJson = JSON.stringify({
      events: events.map((event) => event.toJSON()),
      runs: runs.map((run) => run.toJSON()),
    });
    expect(auditJson).not.toContain("APAC");
    expect(auditJson).not.toContain("region");
    expect(auditJson).not.toContain("select customer_id");
    sourceSpy.mockRestore();
  });

  it("uses safe errors, scope checks, parent checks, and bounded audit summaries", async () => {
    const fixture = await createFixture();
    const sourceSpy = mockOrderSource(fixture);
    await db.Apikey.update({ scopes: ["data:read"] }, { where: { id: fixture.key.id } });

    const scopeResponse = await authorize(
      request(app)
        .post(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`)
        .send({ refresh: true }),
      fixture.key.token
    );
    expect(scopeResponse.status).toBe(403);
    expect(scopeResponse.body.error).toMatchObject({
      code: "API_KEY_SCOPE_REQUIRED",
      message: "The API key does not have the required permission.",
    });
    expect(scopeResponse.body.error.requestId).toBeTruthy();

    const parentResponse = await authorize(
      request(app).get(`/api/v1/projects/${fixture.project.id + 1}/charts/${fixture.chart.id}/data`),
      fixture.key.token
    );
    expect(parentResponse.status).toBe(404);
    expect(parentResponse.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const runs = await db.UpdateRun.findAll({
      order: [["id", "ASC"]],
      where: { apiKeyId: fixture.key.id, triggerType: "data_api" },
    });
    expect(runs).toHaveLength(2);
    expect(runs.map((run) => run.entityType)).toEqual(["chart_data", "chart_data"]);
    expect(JSON.stringify(runs.map((run) => run.summary))).not.toContain("root[].status");
    expect(JSON.stringify(runs.map((run) => run.summary))).not.toContain("select ");
    sourceSpy.mockRestore();
  });

  it("returns stable HTTP contract errors and records invalid authorized requests", async () => {
    process.env.CB_DATA_API_ENABLED = "false";
    const disabled = await request(app).get("/api/v1/projects/1/charts/1/data");
    expect(disabled.status).toBe(404);
    expect(disabled.body.error.code).toBe("RESOURCE_NOT_FOUND");
    delete process.env.CB_DATA_API_ENABLED;

    const malformed = await request(app)
      .post("/api/v1/projects/1/charts/1/data")
      .set("Content-Type", "application/json")
      .send("{");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("INVALID_REQUEST");

    const fixture = await createFixture();
    const sourceSpy = mockOrderSource(fixture);
    const badAccept = await request(app)
      .get(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`)
      .set("Authorization", `Bearer ${fixture.key.token}`)
      .set("Accept", "text/html");
    expect(badAccept.status).toBe(406);
    expect(badAccept.body.error.code).toBe("NOT_ACCEPTABLE");

    const badMedia = await request(app)
      .post(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`)
      .set("Authorization", `Bearer ${fixture.key.token}`)
      .set("Content-Type", "text/plain")
      .send("value");
    expect(badMedia.status).toBe(415);
    expect(badMedia.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    const queryResponse = await authorize(
      request(app).get(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data?refresh=true`),
      fixture.key.token
    );
    expect(queryResponse.status).toBe(400);
    expect(queryResponse.body.error.code).toBe("INVALID_REQUEST");

    const invalidId = await authorize(
      request(app).get(`/api/v1/projects/${fixture.project.id}/charts/1e2/data`),
      fixture.key.token
    );
    expect(invalidId.status).toBe(400);
    expect(invalidId.body.error.code).toBe("INVALID_REQUEST");
    expect(await db.UpdateRun.count({
      where: { apiKeyId: fixture.key.id, entityType: "chart_data" },
    })).toBe(1);
    sourceSpy.mockRestore();
  });

  it("enforces request, response, and per-key rate limits without partial data", async () => {
    const fixture = await createFixture();
    const sourceSpy = mockOrderSource(fixture);

    process.env.CB_DATA_API_MAX_REQUEST_BYTES = "20";
    const requestLimit = await authorize(
      request(app)
        .post(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`)
        .send({ variables: { region: "a-long-region" } }),
      fixture.key.token
    );
    expect(requestLimit.status).toBe(413);
    expect(requestLimit.body.error.code).toBe("REQUEST_TOO_LARGE");
    delete process.env.CB_DATA_API_MAX_REQUEST_BYTES;

    process.env.CB_DATA_API_MAX_RESPONSE_BYTES = "20";
    const responseLimit = await authorize(
      request(app).get(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`),
      fixture.key.token
    );
    expect(responseLimit.status).toBe(413);
    expect(responseLimit.body.error.code).toBe("RESPONSE_TOO_LARGE");
    expect(responseLimit.body).not.toHaveProperty("data");
    delete process.env.CB_DATA_API_MAX_RESPONSE_BYTES;

    const keyOwner = await db.User.findByPk((await db.Apikey.findByPk(fixture.key.id)).user_id);
    const rateKey = await new TeamController().createApiKey(fixture.team.id, keyOwner, {
      allProjects: false,
      name: "Rate key",
      projectIds: [fixture.project.id],
      scopes: ["data:read"],
    });
    process.env.CB_DATA_API_RATE_LIMIT_MAX = "1";
    const first = await authorize(
      request(app).get(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`),
      rateKey.token
    );
    const limited = await authorize(
      request(app).get(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`),
      rateKey.token
    );
    expect(first.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBeTruthy();

    const secondKey = await new TeamController().createApiKey(fixture.team.id, keyOwner, {
      allProjects: false,
      name: "Second key",
      projectIds: [fixture.project.id],
      scopes: ["data:read"],
    });
    const isolated = await authorize(
      request(app).get(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`),
      secondKey.token
    );
    expect(isolated.status).toBe(200);
    sourceSpy.mockRestore();
  });

  it("preserves object, scalar, null, and nested-array dataset results", async () => {
    const fixture = await createFixture();
    const shapeDataset = await db.Dataset.create({
      draft: false,
      name: "Shapes",
      project_ids: [fixture.project.id],
      team_id: fixture.team.id,
    });
    const shapeRequest = await db.DataRequest.create({
      connection_id: fixture.connection.id,
      dataset_id: shapeDataset.id,
      query: "select exact shape",
    });
    await shapeDataset.update({ main_dr_id: shapeRequest.id });
    const values = [
      { total: 12, meta: { source: "exact" } },
      42,
      null,
      { groups: [{ name: "A", values: [1, 2] }] },
    ];
    const sourceSpy = vi.spyOn(getSourceById("postgres").backend, "runDataRequest");

    for (const value of values) {
      sourceSpy.mockResolvedValueOnce({
        dataRequest: shapeRequest,
        responseData: { data: value },
      });
      const response = await authorize(
        request(app).get(`/api/v1/teams/${fixture.team.id}/datasets/${shapeDataset.id}/data`),
        fixture.key.token
      );
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(value);
    }
    sourceSpy.mockRestore();
  });

  it("returns a timeout and aborts a source that supports AbortSignal", async () => {
    const fixture = await createFixture();
    process.env.CB_DATA_API_MAX_EXECUTION_MS = "50";
    let receivedSignal;
    const sourceSpy = vi.spyOn(getSourceById("postgres").backend, "runDataRequest")
      .mockImplementation(({ signal }) => {
        receivedSignal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("Source aborted")), { once: true });
        });
      });

    const response = await authorize(
      request(app).get(`/api/v1/teams/${fixture.team.id}/datasets/${fixture.dataset.id}/data`),
      fixture.key.token
    );
    expect(response.status).toBe(504);
    expect(response.body.error.code).toBe("EXECUTION_TIMEOUT");
    expect(receivedSignal.aborted).toBe(true);

    const run = await db.UpdateRun.findOne({
      order: [["id", "ASC"]],
      where: { apiKeyId: fixture.key.id, entityType: "dataset_data" },
    });
    expect(run).toMatchObject({ status: "failed", errorCode: "EXECUTION_TIMEOUT" });
    sourceSpy.mockRestore();
  });

  it.each(["teamOwner", "teamAdmin", "projectAdmin", "projectEditor", "projectViewer"])(
    "applies current %s project access at route time",
    async (role) => {
      const fixture = await createFixture();
      const sourceSpy = mockOrderSource(fixture);
      const apiKey = await db.Apikey.findByPk(fixture.key.id);
      await db.TeamRole.update({ role, projects: [fixture.project.id] }, {
        where: { team_id: fixture.team.id, user_id: apiKey.user_id },
      });

      const allowed = await authorize(
        request(app).get(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`),
        fixture.key.token
      );
      expect(allowed.status).toBe(200);

      await db.TeamRole.update({ projects: [] }, {
        where: { team_id: fixture.team.id, user_id: apiKey.user_id },
      });
      const afterProjectRemoval = await authorize(
        request(app).get(`/api/v1/projects/${fixture.project.id}/charts/${fixture.chart.id}/data`),
        fixture.key.token
      );
      expect(afterProjectRemoval.status).toBe(role.startsWith("project") ? 404 : 200);
      sourceSpy.mockRestore();
    }
  );
});
