import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const drCacheController = require("../../controllers/DataRequestCacheController");
const runQuery = require("../../modules/ai/orchestrator/tools/runQuery");
const { getSourceById } = require("../../sources");

function mockRunQueryStorage() {
  vi.spyOn(db.Connection, "findByPk").mockResolvedValue({
    id: 42,
    team_id: 7,
    type: "postgres",
    subType: null,
    name: "Analytics DB",
  });
  vi.spyOn(db.Dataset, "create").mockResolvedValue({ id: 100 });
  vi.spyOn(db.Dataset, "update").mockResolvedValue([1]);
  vi.spyOn(db.Dataset, "destroy").mockResolvedValue(1);
  vi.spyOn(db.DataRequest, "create").mockResolvedValue({ id: 200 });
  vi.spyOn(db.DataRequest, "destroy").mockResolvedValue(1);
  vi.spyOn(drCacheController, "remove").mockResolvedValue(null);
}

describe("run_query AI tool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRunQueryStorage();
  });

  it("normalizes row_limit before appending it to SQL queries", async () => {
    const postgres = getSourceById("postgres");
    const runDataRequestSpy = vi.spyOn(postgres.backend, "runDataRequest").mockResolvedValue({
      responseData: {
        data: [{ value: 1 }],
      },
    });

    const result = await runQuery({
      team_id: 7,
      connection_id: 42,
      query: "SELECT 1",
      row_limit: "1; SELECT pg_read_file('/etc/passwd') --",
    });

    expect(runDataRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
      processedQuery: "SELECT 1 LIMIT 1000",
    }));
    expect(db.DataRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      query: "SELECT 1 LIMIT 1000",
    }));
    expect(result.rows).toEqual([{ value: 1 }]);
  });

  it("caps oversized row_limit values before adding LIMIT", async () => {
    const postgres = getSourceById("postgres");
    const runDataRequestSpy = vi.spyOn(postgres.backend, "runDataRequest").mockResolvedValue({
      responseData: {
        data: [],
      },
    });

    await runQuery({
      team_id: 7,
      connection_id: 42,
      query: "SELECT * FROM events;",
      row_limit: 25000,
    });

    expect(runDataRequestSpy).toHaveBeenCalledWith(expect.objectContaining({
      processedQuery: "SELECT * FROM events LIMIT 10000",
    }));
  });

  it("rejects multi-statement SQL before creating temporary data requests", async () => {
    await expect(runQuery({
      team_id: 7,
      connection_id: 42,
      query: "SELECT 1; SELECT 2",
      row_limit: 5,
    })).rejects.toThrow("Multi-statement queries are not allowed");

    expect(db.Dataset.create).not.toHaveBeenCalled();
    expect(db.DataRequest.create).not.toHaveBeenCalled();
  });

  it("rejects dangerous PostgreSQL filesystem functions", async () => {
    await expect(runQuery({
      team_id: 7,
      connection_id: 42,
      query: "SELECT pg_read_file('/etc/passwd')",
      row_limit: 5,
    })).rejects.toThrow("Query contains blocked operations");

    expect(db.Dataset.create).not.toHaveBeenCalled();
  });

  it("rejects quoted-identifier forms of blocked filesystem functions", async () => {
    await expect(runQuery({
      team_id: 7,
      connection_id: 42,
      query: "SELECT \"pg_read_file\"('/etc/passwd')",
      row_limit: 5,
    })).rejects.toThrow("Query contains blocked operations");

    await expect(runQuery({
      team_id: 7,
      connection_id: 42,
      query: "SELECT convert_from(\"pg_read_binary_file\"('/etc/passwd'), 'UTF8')",
      row_limit: 5,
    })).rejects.toThrow("Query contains blocked operations");

    expect(db.Dataset.create).not.toHaveBeenCalled();
  });

  it("rejects sibling PostgreSQL filesystem functions not previously enumerated", async () => {
    for (const query of [
      "SELECT pg_stat_file('/etc/passwd')",
      "SELECT name FROM pg_ls_waldir()",
      "SELECT * FROM pg_ls_logdir()",
      "SELECT pg_current_logfile()",
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(runQuery({
        team_id: 7,
        connection_id: 42,
        query,
        row_limit: 5,
      })).rejects.toThrow("Query contains blocked operations");
    }

    expect(db.Dataset.create).not.toHaveBeenCalled();
  });

  it("rejects quoted-identifier forms of PostgreSQL large-object file functions", async () => {
    for (const query of [
      "SELECT \"lo_import\"('/etc/passwd')",
      "SELECT \"lo_export\"(123, '/tmp/exported')",
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(runQuery({
        team_id: 7,
        connection_id: 42,
        query,
        row_limit: 5,
      })).rejects.toThrow("Query contains blocked operations");
    }

    expect(db.Dataset.create).not.toHaveBeenCalled();
  });

  it("still allows a benign SELECT that mentions a file-like column name", async () => {
    const postgres = getSourceById("postgres");
    vi.spyOn(postgres.backend, "runDataRequest").mockResolvedValue({
      responseData: {
        data: [{ file_name: "report.pdf" }],
      },
    });

    const result = await runQuery({
      team_id: 7,
      connection_id: 42,
      query: "SELECT file_name FROM documents",
      row_limit: 5,
    });

    expect(result.rows).toEqual([{ file_name: "report.pdf" }]);
  });

  it("rejects writable CTEs", async () => {
    await expect(runQuery({
      team_id: 7,
      connection_id: 42,
      query: "WITH deleted AS (DELETE FROM users RETURNING id) SELECT * FROM deleted",
      row_limit: 5,
    })).rejects.toThrow("Query contains blocked operations");

    expect(db.Dataset.create).not.toHaveBeenCalled();
  });

  it("rejects non-SELECT SQL commands", async () => {
    await expect(runQuery({
      team_id: 7,
      connection_id: 42,
      query: "GRANT ALL ON DATABASE app TO attacker",
      row_limit: 5,
    })).rejects.toThrow("Only SELECT/WITH queries are allowed");

    expect(db.Dataset.create).not.toHaveBeenCalled();
  });
});
