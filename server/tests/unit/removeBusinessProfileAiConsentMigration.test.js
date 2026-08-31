import { describe, expect, it, vi } from "vitest";

const migration = require(
  "../../models/migrations/20260831100000-remove-business-profile-ai-consent"
);

describe("business profile AI consent removal migration", () => {
  it("removes the old profile consent column", async () => {
    const queryInterface = {
      describeTable: vi.fn().mockResolvedValue({ aiContextAllowed: {}, id: {} }),
      removeColumn: vi.fn().mockResolvedValue(undefined),
      showAllTables: vi.fn().mockResolvedValue(["TeamBusinessProfile"]),
    };

    await migration.up(queryInterface);

    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      "TeamBusinessProfile", "aiContextAllowed"
    );
  });
});
