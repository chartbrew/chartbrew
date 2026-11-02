import {
  beforeEach, describe, expect, it, vi
} from "vitest";

const db = require("../../models/models");
const TeamController = require("../../controllers/TeamController");

describe("TeamController role security", () => {
  let controller;

  beforeEach(() => {
    vi.restoreAllMocks();
    controller = new TeamController();
  });

  it("rejects assigning team ownership through a role update", async () => {
    vi.spyOn(controller, "getTeamRole").mockResolvedValue({
      team_id: 7,
      user_id: 42,
      role: "teamAdmin",
    });
    const updateSpy = vi.spyOn(db.TeamRole, "update").mockResolvedValue([1]);

    await expect(controller.updateTeamRole(7, 42, { role: "teamOwner" }))
      .rejects.toThrow("Team ownership can only be changed through an ownership transfer");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("rejects changing the current team owner's role", async () => {
    vi.spyOn(controller, "getTeamRole").mockResolvedValue({
      team_id: 7,
      user_id: 42,
      role: "teamOwner",
    });
    const updateSpy = vi.spyOn(db.TeamRole, "update").mockResolvedValue([1]);

    await expect(controller.updateTeamRole(7, 42, { role: "teamAdmin" }))
      .rejects.toThrow("Team ownership can only be changed through an ownership transfer");
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("still allows routine non-owner role changes", async () => {
    const getTeamRoleSpy = vi.spyOn(controller, "getTeamRole")
      .mockResolvedValueOnce({ team_id: 7, user_id: 42, role: "projectEditor" })
      .mockResolvedValueOnce({ team_id: 7, user_id: 42, role: "teamAdmin" });
    const updateSpy = vi.spyOn(db.TeamRole, "update").mockResolvedValue([1]);

    const result = await controller.updateTeamRole(7, 42, { role: "teamAdmin" });

    expect(updateSpy).toHaveBeenCalledWith(
      { role: "teamAdmin", projects: [], canExport: true },
      { where: { team_id: 7, user_id: 42 } }
    );
    expect(getTeamRoleSpy).toHaveBeenCalledTimes(2);
    expect(result.role).toBe("teamAdmin");
  });

  it("only writes supported team role fields", async () => {
    vi.spyOn(db.Project, "count").mockResolvedValue(1);
    vi.spyOn(controller, "getTeamRole")
      .mockResolvedValueOnce({ team_id: 7, user_id: 42, role: "projectEditor" })
      .mockResolvedValueOnce({ team_id: 7, user_id: 42, role: "projectAdmin" });
    const updateSpy = vi.spyOn(db.TeamRole, "update").mockResolvedValue([1]);

    await controller.updateTeamRole(7, 42, {
      id: 99,
      user_id: 84,
      team_id: 12,
      role: "projectAdmin",
      projects: [3],
      canExport: true,
      createdAt: "2026-08-04T00:00:00.000Z",
    });

    expect(updateSpy).toHaveBeenCalledWith(
      {
        role: "projectAdmin",
        projects: [3],
        canExport: true,
      },
      { where: { team_id: 7, user_id: 42 } }
    );
  });
});
