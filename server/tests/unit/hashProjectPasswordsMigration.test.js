import {
  describe, expect, it, vi
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const migration = require("../../models/migrations/20260706090000-hash-project-passwords.js");

describe("hash project passwords migration", () => {
  it("quotes the Project table when selecting passwords", async () => {
    const queryInterface = {
      queryGenerator: {
        quoteTable: vi.fn((table) => `"${table}"`),
        quoteIdentifier: vi.fn((identifier) => `"${identifier}"`),
      },
      sequelize: {
        query: vi.fn().mockResolvedValue([[]]),
      },
    };

    await migration.up(queryInterface);

    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      "SELECT \"id\" AS \"id\", \"password\" AS \"password\" FROM \"Project\" WHERE \"password\" IS NOT NULL AND \"password\" != ''"
    );
  });
});
