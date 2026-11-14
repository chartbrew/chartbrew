import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { normalizeClickhouseQuery } = require("../../sources/plugins/clickhouse/clickhouse.query");
const ClickHouseConnection = require("../../sources/plugins/clickhouse/clickhouse.connection");
const protocol = require("../../sources/plugins/clickhouse/clickhouse.protocol");
const db = require("../../models/models");
const drCacheController = require("../../controllers/DataRequestCacheController");
const DatasetController = require("../../controllers/DatasetController");
const createDataset = require("../../modules/ai/orchestrator/tools/createDataset");
const createTemporaryChart = require("../../modules/ai/orchestrator/tools/createTemporaryChart");
const createDashboardChart = require("../../modules/ai/orchestrator/tools/createDashboardChart");
const updateDataset = require("../../modules/ai/orchestrator/tools/updateDataset");
const validateQuery = require("../../modules/ai/orchestrator/tools/validateQuery");
const runQuery = require("../../modules/ai/orchestrator/tools/runQuery");

const externalFunctions = [
  "file", "fileCluster", "url", "urlCluster", "s3", "s3Cluster", "remote", "remoteSecure",
  "mysql", "postgresql", "sqlite", "redis", "mongodb", "executable", "executablePool",
  "hdfs", "hdfsCluster", "jdbc", "odbc", "gcs", "azureBlobStorage", "azureBlobStorageCluster",
  "hudi", "hudiCluster", "iceberg", "icebergS3", "icebergAzure", "icebergHDFS",
  "deltaLake", "deltaLakeCluster", "hive", "oss", "cosn", "cluster", "clusterAllReplicas",
];
const unsafeQuery = "SELECT * FROM file('probe.csv', 'CSV', 'x String')";

afterEach(() => vi.restoreAllMocks());

describe("ClickHouse SQL policy", () => {
  it.each(externalFunctions)("rejects %s in nested and quoted calls", (name) => {
    for (const identifier of [name, name.toUpperCase(), `"${name}"`, `\`${name}\``]) {
      expect(() => normalizeClickhouseQuery(`WITH rows AS (SELECT * FROM ${identifier} /* comment */ ('probe')) SELECT * FROM rows`))
        .toThrow("blocked operations");
      expect(() => normalizeClickhouseQuery(`SELECT 1 FROM events JOIN ${identifier} -- comment\n('probe') ON 1`))
        .toThrow("blocked operations");
    }
  });

  it.each([
    "SELECT remote, mysql_version, sum(amount) FROM orders GROUP BY remote, mysql_version",
    "SELECT * FROM numbers(10)",
    "SELECT * FROM system.tables",
    "SELECT URLHierarchy(url), fileName() FROM events",
    "WITH rows AS (SELECT * FROM orders) SELECT * FROM rows JOIN customers USING (customer_id)",
    "SELECT 'update; file( -- text' AS action, `delete`, \"url\" FROM events",
    "SELECT 'it\\'s file(' AS message, 'it''s redis(' AS other",
    "SELECT * FROM events WHERE id = {{event_id}}",
    "SELECT * FROM events WHERE id = {event_id:UInt64}",
    "/* file('probe') */ SELECT count() FROM events -- url('probe')",
    "SELECT count() FROM events SETTINGS max_threads = 2",
  ])("preserves ordinary SQL: %s", (query) => {
    expect(normalizeClickhouseQuery(query)).toBe(query);
  });

  it.each([
    "SELECT 1; SELECT 2", "DROP TABLE events", "SELECT * FROM events INTO OUTFILE 'probe'",
    "SELECT 1 SETTINGS readonly = 0", "SELECT 1 SETTINGS allow_ddl = 1",
    "SELECT * FROM `fi\\le`('probe')", "SELECT 'unfinished",
  ])("rejects unsafe or unsupported SQL: %s", (query) => {
    expect(() => normalizeClickhouseQuery(query)).toThrow(/queries|blocked|identifiers|unfinished/);
  });

  it("removes a final semicolon before a trailing comment", () => {
    expect(normalizeClickhouseQuery("SELECT 1; -- comment")).toBe("SELECT 1 -- comment");
  });
});

describe("ClickHouse execution boundaries", () => {
  it("rejects saved and substituted SQL before cache access or connection", async () => {
    const connect = vi.spyOn(ClickHouseConnection.prototype, "connect").mockRejectedValue(new Error("unexpected connection"));
    const cache = vi.spyOn(drCacheController, "findLast").mockResolvedValue({ responseData: { data: [] } });
    for (const getCache of [true, false]) {
      await expect(protocol.runDataRequest({
        connection: { id: 1 }, dataRequest: { id: 2, query: unsafeQuery }, getCache,
      })).rejects.toThrow("blocked operations");
      await expect(protocol.runDataRequest({
        connection: { id: 1 }, dataRequest: { id: 2, query: "SELECT 1" }, processedQuery: unsafeQuery, getCache,
      })).rejects.toThrow("blocked operations");
    }
    expect(() => protocol.runChartQuery({ connection: {}, query: unsafeQuery })).toThrow("blocked operations");
    await expect(new ClickHouseConnection({}).query(unsafeQuery)).rejects.toThrow("blocked operations");
    expect(connect).not.toHaveBeenCalled();
    expect(cache).not.toHaveBeenCalled();
  });

  it("executes normal SQL with database read-only mode", async () => {
    const connector = new ClickHouseConnection({});
    connector.client = { query: vi.fn().mockResolvedValue({ json: async () => [{ total: 1 }] }) };
    expect(await connector.query("SELECT count() AS total FROM events")).toEqual([{ total: 1 }]);
    expect(connector.client.query).toHaveBeenCalledWith(expect.objectContaining({
      query: "SELECT count() AS total FROM events", clickhouse_settings: { readonly: 1 },
    }));
  });
});

describe("AI SQL persistence boundaries", () => {
  beforeEach(() => {
    vi.spyOn(db.Connection, "findByPk").mockResolvedValue({ id: 1, team_id: 7, type: "clickhouse" });
    vi.spyOn(db.Project, "findByPk").mockResolvedValue({ id: 2, team_id: 7, ghost: false });
    vi.spyOn(db.Dataset, "findByPk").mockResolvedValue({ id: 3, team_id: 7, main_dr_id: 4 });
    vi.spyOn(db.DataRequest, "findByPk").mockResolvedValue({ id: 4, connection_id: 1 });
    vi.spyOn(DatasetController.prototype, "createWithDataRequests").mockRejectedValue(new Error("unexpected save"));
    vi.spyOn(db.Dataset, "create").mockRejectedValue(new Error("unexpected save"));
    vi.spyOn(db.Dataset, "update").mockRejectedValue(new Error("unexpected update"));
    vi.spyOn(db.DataRequest, "update").mockRejectedValue(new Error("unexpected update"));
  });

  it.each([createDataset, createTemporaryChart, createDashboardChart, updateDataset, runQuery])(
    "rejects unsafe SQL before %s writes anything", async (tool) => {
      await expect(tool({
        team_id: 7, connection_id: 1, project_id: 2, dataset_id: tool === updateDataset ? 3 : undefined,
        name: "Changed name", query: unsafeQuery,
      })).rejects.toThrow("blocked operations");
      expect(DatasetController.prototype.createWithDataRequests).not.toHaveBeenCalled();
      expect(db.Dataset.create).not.toHaveBeenCalled();
      expect(db.Dataset.update).not.toHaveBeenCalled();
      expect(db.DataRequest.update).not.toHaveBeenCalled();
    }
  );

  it("reports the real policy result using the saved connection type", async () => {
    expect(await validateQuery({ team_id: 7, connection_id: 1, dialect: "mysql", query: unsafeQuery }))
      .toMatchObject({ valid: false });
    expect(await validateQuery({ team_id: 7, connection_id: 1, query: "SELECT 'update' FROM events" }))
      .toMatchObject({ valid: true });
    await expect(validateQuery({ team_id: 8, connection_id: 1, query: "SELECT 1" }))
      .rejects.toThrow("does not belong");
  });
});
