import { describe, expect, it, vi } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Sequelize = require("sequelize");
const externalDbConnection = require("../../sources/shared/sql/externalDbConnection");

describe("external PostgreSQL search path", () => {
  it.each([
    "tenant_data",
    '"tenant-data", public',
    "tenant'; SELECT 1; --",
    "",
  ])("sets %j as a bound value on every new connection", async (searchPath) => {
    const authenticate = vi.spyOn(Sequelize.prototype, "authenticate").mockResolvedValue();
    let connection;

    try {
      connection = await externalDbConnection({
        type: "postgres",
        connectionString: `postgres://user:password@localhost/database?search_path=${encodeURIComponent(searchPath)}`,
      });
      const firstClient = { query: vi.fn().mockResolvedValue() };
      const secondClient = { query: vi.fn().mockResolvedValue() };

      await connection.runHooks("afterConnect", firstClient);
      await connection.runHooks("afterConnect", secondClient);

      for (const client of [firstClient, secondClient]) {
        expect(client.query).toHaveBeenCalledWith(
          "SELECT pg_catalog.set_config('search_path', $1, false)", [searchPath]
        );
      }
    } finally {
      authenticate.mockRestore();
      await connection?.close();
    }
  });

  it("keeps the database default when the URL has no search path", async () => {
    const authenticate = vi.spyOn(Sequelize.prototype, "authenticate").mockResolvedValue();
    let connection;

    try {
      connection = await externalDbConnection({
        type: "postgres",
        connectionString: "postgres://user:password@localhost/database",
      });
      const client = { query: vi.fn() };
      await connection.runHooks("afterConnect", client);
      expect(client.query).not.toHaveBeenCalled();
    } finally {
      authenticate.mockRestore();
      await connection?.close();
    }
  });
});
