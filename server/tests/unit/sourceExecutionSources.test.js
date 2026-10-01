import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const requestPath = require.resolve("../../modules/safeRequest");
const originalRequest = require.cache[requestPath];
const request = vi.fn();
require.cache[requestPath] = { id: requestPath, filename: requestPath, loaded: true, exports: request };
const sqlPath = require.resolve("../../sources/shared/sql/externalDbConnection");
const requestPromisePath = require.resolve("request-promise");
const originalSql = require.cache[sqlPath];
const originalRequestPromise = require.cache[requestPromisePath];
const sqlConnect = vi.fn();
const sourceRequest = vi.fn();
require.cache[sqlPath] = { id: sqlPath, filename: sqlPath, loaded: true, exports: sqlConnect };
require.cache[requestPromisePath] = { id: requestPromisePath, filename: requestPromisePath, loaded: true, exports: sourceRequest };
const execution = require("../../modules/sourceExecution");
const api = require("../../sources/shared/protocols/api.protocol");
const paginate = require("../../modules/paginateRequests");
const db = require("../../models/models");
const cache = require("../../controllers/DataRequestCacheController");
const runExecution = execution.runSourceExecution;
const records = new Map();
const model = {
  create: async (record) => {
    records.set(record.id, { ...record });
    return record;
  },
  findByPk: async (id) => records.get(id),
  update: async (values, { where }) => {
    const record = records.get(where.id);
    if (record.status !== where.status) return [0];
    Object.assign(record, values);
    return [1];
  },
};
const connection = {
  id: 4,
  team_id: 7,
  type: "api",
  getApiUrl: () => "https://example.com",
  getHeaders: () => [],
};
const dataRequest = { id: 3, dataset_id: 2, method: "GET", route: "/records" };

describe("source execution boundaries", () => {
  beforeEach(() => {
    records.clear();
    request.mockReset();
    sourceRequest.mockReset();
    sqlConnect.mockReset();
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue(connection);
    vi.spyOn(cache, "create").mockResolvedValue(true);
    vi.spyOn(cache, "findLast").mockResolvedValue(false);
    vi.spyOn(execution, "runSourceExecution").mockImplementation((options, operation) => runExecution(options, operation, { model }));
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => {
    if (originalSql) require.cache[sqlPath] = originalSql;
    else delete require.cache[sqlPath];
    if (originalRequestPromise) require.cache[requestPromisePath] = originalRequestPromise;
    else delete require.cache[requestPromisePath];
    if (originalRequest) require.cache[requestPath] = originalRequest;
    else delete require.cache[requestPath];
  });

  it("returns a cache hit without an execution or a policy call", async () => {
    const cached = { connection_id: 4, dataRequest, responseData: { data: [1] } };
    cache.findLast.mockResolvedValue(cached);
    const before = vi.spyOn(execution, "beforeSourceExecution");
    expect(await api.runDataRequest({ connection, dataRequest, getCache: true })).toMatchObject({ responseData: { data: [1] } });
    expect(request).not.toHaveBeenCalled();
    expect(before).not.toHaveBeenCalled();
    expect(records.size).toBe(0);
  });

  it("records one complete paginated fetch before cache persistence", async () => {
    request.mockResolvedValueOnce({ statusCode: 200, body: '[{"id":1}]' })
      .mockResolvedValueOnce({ statusCode: 200, body: "[]" });
    cache.create.mockImplementation(async () => {
      expect([...records.values()].map((record) => record.status)).toEqual(["success"]);
    });
    const result = await api.runDataRequest({ connection, dataRequest: {
      ...dataRequest, route: "/records?limit=1&offset=0", pagination: true, items: "limit", offset: "offset",
    } });
    expect(result.responseData.data).toEqual([{ id: 1 }]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(records.size).toBe(1);
  });

  it("does not cache or count partial data after a later page fails", async () => {
    request.mockResolvedValueOnce({ statusCode: 200, body: '[{"id":1}]' })
      .mockResolvedValueOnce({ statusCode: 500, body: '{"error":"Query failed"}' });
    await expect(api.runDataRequest({ connection, dataRequest: {
      ...dataRequest, route: "/records?limit=1&offset=0", pagination: true, items: "limit", offset: "offset",
    } })).rejects.toThrow("Query failed");
    expect([...records.values()].map((record) => record.status)).toEqual(["failed"]);
    expect(cache.create).not.toHaveBeenCalled();
  });

  it("keeps earlier cursor pages when the final page is empty", async () => {
    request.mockResolvedValueOnce({ statusCode: 200, body: '{"rows":[{"id":1}],"next":"page-2"}' })
      .mockResolvedValueOnce({ statusCode: 204, body: "" });
    const result = await api.runDataRequest({ connection, dataRequest: {
      ...dataRequest, template: "cursor", pagination: true, items: "next", offset: "cursor", itemsLimit: 0,
    } });
    expect(result.responseData.data.rows).toEqual([{ id: 1 }]);
    expect(result.responseData.data.next).toBeNull();
    expect(request).toHaveBeenCalledTimes(2);
    expect([...records.values()].map((record) => record.status)).toEqual(["success"]);
  });

  it("preserves successful fetch accounting when a cache write fails", async () => {
    request.mockResolvedValue({ statusCode: 200, body: "[]" });
    cache.create.mockRejectedValue(new Error("Cache unavailable"));
    await expect(api.runDataRequest({ connection, dataRequest })).rejects.toThrow("Cache unavailable");
    expect([...records.values()].map((record) => record.status)).toEqual(["success"]);
  });

  it("counts an unsaved preview and keeps safe source errors readable", async () => {
    request.mockResolvedValueOnce({ statusCode: 204, body: "" });
    expect(await api.previewDataRequest({ connection, dataRequest: { route: "/records" } })).toEqual([]);
    expect([...records.values()][0]).toMatchObject({ status: "success", dataRequestId: null });
    request.mockResolvedValueOnce({ statusCode: 403, body: '{"error":{"message":"Permission denied"}}' });
    await expect(api.previewDataRequest({ connection, dataRequest })).rejects.toMatchObject({
      statusCode: 403, message: "The data source returned HTTP 403. Permission denied",
    });
    expect([...records.values()][1].status).toBe("failed");
  });

  it("does not count a connection test", async () => {
    request.mockResolvedValue({ statusCode: 200, body: "{}" });
    expect(await api.testConnection({ connection })).toEqual({ success: true });
    expect(records.size).toBe(0);
  });

  it.each(["custom", "pages", "url", "cursor", "stripe"])("rejects source HTTP failures in %s pagination", async (template) => {
    request.mockResolvedValue({ statusCode: 500, body: '{"error":"Source unavailable"}' });
    await expect(paginate(template, {
      options: { qs: {} }, limit: 10, items: "next", offset: "offset", paginationField: "next",
    })).rejects.toMatchObject({ statusCode: 500 });
  });

  it.each(["custom", "pages", "cursor"])("accepts an empty first page in %s pagination", async (template) => {
    request.mockResolvedValue({ statusCode: 200, body: "[]" });
    await expect(paginate(template, { options: { qs: {} }, limit: 10, items: "next", offset: "offset" })).resolves.toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(["mysql", "postgres"])("records SQL queries but excludes %s schema inspection", async (type) => {
    const sql = require("../../sources/shared/sql/sql.protocol");
    const query = vi.fn().mockResolvedValue([]);
    const close = vi.fn();
    sqlConnect.mockResolvedValue({ query, close });
    const saved = { ...connection, type, schema: { tables: ["orders"] } };
    expect(await sql.exploreReadOnly({ connection: saved, operation: "inspect" })).toMatchObject({ resources: [{ name: "orders" }] });
    expect(records.size).toBe(0);
    await sql.runChartQuery({ connection: saved, query: "SELECT 1" });
    expect([...records.values()][0]).toMatchObject({ sourceId: type, status: "success" });
    expect(query).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not repeat a failed MongoDB query", async () => {
    const mongoose = require("mongoose");
    const mongo = require("../../sources/plugins/mongodb/mongodb.protocol");
    const toArray = vi.fn().mockRejectedValue(new Error("Mongo query failed"));
    const find = vi.fn().mockReturnValue({ toArray });
    const client = { asPromise: vi.fn(), close: vi.fn(), collection: () => ({ find }) };
    vi.spyOn(mongoose, "createConnection").mockReturnValue(client);
    db.Connection.findByPk.mockResolvedValue({ ...connection, type: "mongodb", connectionString: "mongodb://example.com/test" });
    await expect(mongo.runChartQuery({ connection: { id: 4 }, query: 'collection("orders").find({})' })).rejects.toThrow("Mongo query failed");
    expect(find).toHaveBeenCalledTimes(1);
    expect(toArray).toHaveBeenCalledTimes(1);
    expect([...records.values()][0]).toMatchObject({ sourceId: "mongodb", status: "failed" });
  });

  it("records ClickHouse success before disconnect", async () => {
    const protocol = require("../../sources/plugins/clickhouse/clickhouse.protocol");
    const Connector = require("../../sources/plugins/clickhouse/clickhouse.connection");
    db.Connection.findByPk.mockResolvedValue({ ...connection, type: "clickhouse" });
    vi.spyOn(Connector.prototype, "query").mockResolvedValue([]);
    vi.spyOn(Connector.prototype, "disconnect").mockRejectedValue(new Error("Close failed"));
    await expect(protocol.runChartQuery({ connection, query: "SELECT 1" })).rejects.toThrow("Close failed");
    expect([...records.values()][0]).toMatchObject({ sourceId: "clickhouse", status: "success" });
  });

  it("records a Firestore fetch before optional collection metadata", async () => {
    const Firestore = require("../../sources/plugins/firestore/firestore.connection");
    const client = Object.create(Firestore.prototype);
    client.connection = { ...connection, type: "firestore" };
    client.db = { collection: () => ({ get: async () => [] }) };
    client.getSubCollectionsRefs = vi.fn().mockRejectedValue(new Error("Metadata failed"));
    await expect(client.get({ query: "orders" })).rejects.toThrow("Metadata failed");
    expect([...records.values()][0]).toMatchObject({ sourceId: "firestore", status: "success" });
  });

  it("records one Realtime DB read and propagates a read error", async () => {
    const Realtime = require("../../sources/plugins/realtimedb/realtimedb.connection");
    const client = Object.create(Realtime.prototype);
    client.connection = { ...connection, type: "realtimedb" };
    const once = vi.fn((_event, success) => success({ forEach: () => {} }));
    client.db = { ref: () => ({ once }) };
    expect(await client.getData({ route: "/orders" })).toEqual([]);
    once.mockImplementation((_event, _success, failure) => failure(new Error("Permission denied")));
    await expect(client.getData({ route: "/orders" })).rejects.toThrow("Permission denied");
    expect([...records.values()].map((record) => record.status)).toEqual(["success", "failed"]);
    expect(once).toHaveBeenCalledTimes(2);
  });

  it("keeps Customer.io source success when a configured series cannot be transformed", async () => {
    const customerio = require("../../sources/plugins/customerio/customerio.connection");
    sourceRequest.mockResolvedValue({ body: '{"metric":{"series":{}}}' });
    await expect(customerio.getCampaignMetrics({ ...connection, type: "customerio" }, {
      method: "GET", route: "campaigns/1/metrics", configuration: { series: "missing", period: "days" },
    })).rejects.toThrow("map");
    expect([...records.values()][0]).toMatchObject({ sourceId: "customerio", status: "success" });
  });

  it("counts Jira pages once and each trend search separately", async () => {
    const jira = require("../../sources/plugins/jira/jira.protocol");
    const jiraConnection = require("../../sources/plugins/jira/jira.connection");
    const query = vi.spyOn(jiraConnection, "jiraRequest").mockResolvedValueOnce({ issues: [{ id: "1" }], nextPageToken: "next" })
      .mockResolvedValue({ issues: [] });
    const saved = { ...connection, type: "jira" };
    await jira.fetchJiraRows(saved, { resource: "issues" });
    expect(records.size).toBe(1);
    expect(query).toHaveBeenCalledTimes(2);
    await jira.fetchJiraRows(saved, { resource: "issues", jql: "project = TEST", visual: { startDate: "2026-01-01", endDate: "2026-01-31" },
      transform: { type: "created_resolved_trend" } });
    expect(records.size).toBe(3);
    expect([...records.values()].every((record) => record.status === "success")).toBe(true);
  });

  it("counts an official Stripe paginated preview once and rejects an incomplete fetch", async () => {
    const stripe = require("../../sources/plugins/stripeOfficial/stripeOfficial.protocol");
    const saved = { ...connection, type: "stripeOfficial", password: "sk_test_example" };
    db.Connection.findByPk.mockResolvedValue(saved);
    const config = { ...stripe.DEFAULT_CONFIGURATION, resource: "customers", mode: "raw", dateRange: {}, pagination: { maxRecords: 10 } };
    sourceRequest.mockResolvedValueOnce({ data: [{ id: "cus_1" }], has_more: true })
      .mockResolvedValueOnce({ data: [], has_more: false });
    await stripe.previewDataRequest({ connection: saved, dataRequest: { configuration: config } });
    expect(records.size).toBe(1);
    expect(sourceRequest).toHaveBeenCalledTimes(2);
    sourceRequest.mockResolvedValueOnce({ data: [{ id: "cus_1" }], has_more: true })
      .mockRejectedValueOnce(new Error("Stripe failed"));
    await expect(stripe.previewDataRequest({ connection: saved, dataRequest: { configuration: config } })).rejects.toThrow("Stripe failed");
    expect([...records.values()].map((record) => record.status)).toEqual(["success", "failed"]);
  });

});
