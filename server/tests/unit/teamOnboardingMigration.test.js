import {
  describe, expect, it, vi,
} from "vitest";

const migration = require("../../models/migrations/20260813100000-add-team-onboarding");

describe("team onboarding migration", () => {
  it("adds team fields, completes legacy teams, and creates the business profile table", async () => {
    const queryInterface = {
      addColumn: vi.fn().mockResolvedValue(undefined),
      bulkUpdate: vi.fn().mockResolvedValue(undefined),
      createTable: vi.fn().mockResolvedValue(undefined),
      describeTable: vi.fn().mockResolvedValue({ id: {} }),
      showAllTables: vi.fn().mockResolvedValue(["Team"]),
    };
    await migration.up(queryInterface);
    expect(queryInterface.addColumn).toHaveBeenCalledWith("Team", "useCases", expect.any(Object));
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "Team", "onboardingCompletedAt", expect.any(Object)
    );
    expect(queryInterface.bulkUpdate).toHaveBeenCalledWith(
      "Team",
      expect.objectContaining({ onboardingCompletedAt: expect.any(Date) }),
      { onboardingCompletedAt: null }
    );
    expect(queryInterface.createTable).toHaveBeenCalledWith(
      "TeamBusinessProfile",
      expect.objectContaining({
        logoData: expect.any(Object),
        team_id: expect.objectContaining({ unique: true }),
      })
    );
    const columns = queryInterface.createTable.mock.calls[0][1];
    expect(columns).not.toHaveProperty("aiContextAllowed");
  });

  it("does not replace fields or tables that already exist", async () => {
    const queryInterface = {
      addColumn: vi.fn(),
      bulkUpdate: vi.fn(),
      createTable: vi.fn(),
      describeTable: vi.fn().mockResolvedValue({
        id: {}, onboardingCompletedAt: {}, useCases: {},
      }),
      showAllTables: vi.fn().mockResolvedValue(["Team", "TeamBusinessProfile"]),
    };
    await migration.up(queryInterface);
    expect(queryInterface.addColumn).not.toHaveBeenCalled();
    expect(queryInterface.bulkUpdate).not.toHaveBeenCalled();
    expect(queryInterface.createTable).not.toHaveBeenCalled();
  });
});
