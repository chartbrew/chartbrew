import { describe, expect, it, vi } from "vitest";

const migration = require(
  "../../models/migrations/20260831110000-add-team-ai-enabled"
);

describe("team AI setting migration", () => {
  it("adds an enabled team setting by default", async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(undefined),
      describeTable: vi.fn().mockResolvedValue({ id: {} }),
    };

    await migration.up(queryInterface);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "Team",
      "aiEnabled",
      expect.objectContaining({ allowNull: false, defaultValue: true })
    );
  });
});
