import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sqlProtocol = require("../../sources/shared/sql/sql.protocol.js");
const sqlProtocolPath = require.resolve("../../sources/shared/sql/sql.protocol.js");
const externalDbConnectionPath = require.resolve("../../sources/shared/sql/externalDbConnection.js");

function requireSqlProtocolWithConnection(fakeConnection) {
  const originalSqlProtocolCache = require.cache[sqlProtocolPath];
  const originalExternalDbConnectionCache = require.cache[externalDbConnectionPath];

  delete require.cache[sqlProtocolPath];
  require.cache[externalDbConnectionPath] = {
    id: externalDbConnectionPath,
    filename: externalDbConnectionPath,
    loaded: true,
    exports: async () => fakeConnection,
  };

  const mockedSqlProtocol = require(sqlProtocolPath);

  return {
    mockedSqlProtocol,
    restore() {
      delete require.cache[sqlProtocolPath];

      if (originalSqlProtocolCache) {
        require.cache[sqlProtocolPath] = originalSqlProtocolCache;
      }

      if (originalExternalDbConnectionCache) {
        require.cache[externalDbConnectionPath] = originalExternalDbConnectionCache;
      } else {
        delete require.cache[externalDbConnectionPath];
      }
    },
  };
}

describe("shared SQL protocol", () => {
  it("describes PostgreSQL tables in their resolved search-path schemas", async () => {
    const describeTable = vi.fn().mockResolvedValue({ id: {}, total: {} });
    const query = vi.fn().mockResolvedValue([
      { table_name: "orders", table_schema: "tenant-data" },
      { table_name: "users", table_schema: "public" },
    ]);

    const schema = await sqlProtocol.getSchemaFromDbConnection({
      getDialect: () => "postgres",
      query,
      getQueryInterface: () => ({ describeTable }),
    });

    expect(query.mock.calls[0][0]).toContain("pg_catalog.current_schemas(false)");
    expect(query.mock.calls[0][0]).toContain("pg_catalog.pg_table_is_visible(c.oid)");
    expect(describeTable.mock.calls).toEqual([
      ["orders", { schema: "tenant-data" }],
      ["users", { schema: "public" }],
    ]);
    expect(schema).toEqual({
      tables: ["orders", "users"],
      description: { orders: ["id", "total"], users: ["id", "total"] },
    });
  });

  it("returns an empty PostgreSQL schema when no tables are visible", async () => {
    const schema = await sqlProtocol.getSchemaFromDbConnection({
      getDialect: () => "postgres",
      query: async () => [],
    });

    expect(schema).toEqual({ tables: [], description: {} });
  });

  it("loads table descriptions sequentially before the connection can be closed", async () => {
    let activeDescriptions = 0;
    let maxConcurrentDescriptions = 0;

    const queryInterface = {
      showAllTables() {
        return Promise.resolve(["users", "orders", "invoices"]);
      },
      async describeTable(table) {
        activeDescriptions += 1;
        maxConcurrentDescriptions = Math.max(maxConcurrentDescriptions, activeDescriptions);
        await new Promise((resolve) => {
          setTimeout(resolve, 1);
        });
        activeDescriptions -= 1;

        return {
          id: {
            type: `${table}-id`,
          },
        };
      },
    };

    const schema = await sqlProtocol.getSchemaFromDbConnection({
      getQueryInterface() {
        return queryInterface;
      },
    });

    expect(maxConcurrentDescriptions).toBe(1);
    expect(schema).toEqual({
      tables: ["users", "orders", "invoices"],
      description: {
        users: ["id"],
        orders: ["id"],
        invoices: ["id"],
      },
    });
  });

  it("keeps the SQL connection open until schema loading finishes", async () => {
    let closed = false;
    let closedWhileDescribing = false;

    const fakeConnection = {
      getQueryInterface() {
        return {
          showAllTables() {
            return Promise.resolve(["users"]);
          },
          async describeTable() {
            await new Promise((resolve) => {
              setTimeout(resolve, 1);
            });
            closedWhileDescribing = closed;

            return {
              id: {},
            };
          },
        };
      },
      async close() {
        closed = true;
      },
    };

    const { mockedSqlProtocol, restore } = requireSqlProtocolWithConnection(fakeConnection);

    try {
      await mockedSqlProtocol.getSchema({ connection: { type: "postgres" } });
    } finally {
      restore();
    }

    expect(closedWhileDescribing).toBe(false);
    expect(closed).toBe(true);
  });

  it("rejects missing SQL queries before Sequelize receives a null query", () => {
    expect(() => {
      sqlProtocol.getQueryToExecute({
        processedQuery: null,
        dataRequest: { query: null },
      });
    }).toThrow("SQL query is required");
  });

  it("prefers processed SQL queries when variables are applied", () => {
    expect(sqlProtocol.getQueryToExecute({
      processedQuery: "select * from users where id = 1",
      dataRequest: { query: "select * from users where id = {{user_id}}" },
    })).toBe("select * from users where id = 1");
  });
});
