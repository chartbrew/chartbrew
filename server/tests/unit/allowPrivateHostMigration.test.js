import {
  describe, expect, it, vi
} from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const addColumnMigration = require("../../models/migrations/20260305090000-add-allow-private-host-connection.js");
const resetMigration = require("../../models/migrations/20260706090000-reset-api-allow-private-host.js");

describe("allowPrivateHost migration", () => {
  it("does not opt existing API connections into private-host access", async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(),
      bulkUpdate: vi.fn().mockResolvedValue(),
    };

    await addColumnMigration.up(queryInterface);

    expect(queryInterface.bulkUpdate).toHaveBeenCalledWith(
      "Connection",
      { allowPrivateHost: null },
      { type: "api" }
    );
  });

  it("resets already-migrated API connections to the server default policy", async () => {
    const queryInterface = {
      bulkUpdate: vi.fn().mockResolvedValue(),
    };

    await resetMigration.up(queryInterface);

    expect(queryInterface.bulkUpdate).toHaveBeenCalledWith(
      "Connection",
      { allowPrivateHost: null },
      { type: "api" }
    );
  });
});
