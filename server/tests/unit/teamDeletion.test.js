import {
  afterEach, beforeEach, describe, expect, it, vi,
} from "vitest";

const { Op } = require("sequelize");
const db = require("../../models/models");
const runtimeCache = require("../../modules/runtimeCache");
const TeamController = require("../../controllers/TeamController");

describe("team deletion", () => {
  let transaction;
  let controller;

  beforeEach(() => {
    controller = new TeamController();
    transaction = { commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(db.sequelize, "transaction").mockResolvedValue(transaction);
    vi.spyOn(db.TeamRole, "findAll").mockResolvedValue([{ team_id: 8 }]);
    vi.spyOn(db.AiConversation, "findAll").mockResolvedValue([{ id: "conversation-7" }]);
    vi.spyOn(runtimeCache, "clearPendingAiActions").mockResolvedValue(undefined);
    [
      "AiMessage", "AiUsage", "AiConversation", "PinnedDashboard", "SavedQuery",
      "Integration", "OAuth", "Template", "Apikey", "Connection", "Dataset",
      "Project", "TeamRole", "Team",
    ].forEach((model) => vi.spyOn(db[model], "destroy").mockResolvedValue(1));
  });

  afterEach(() => vi.restoreAllMocks());

  it("removes the team's AI records in dependency order within the transaction", async () => {
    await expect(controller.deleteTeam(7, 42)).resolves.toBe(true);

    expect(db.AiConversation.findAll).toHaveBeenCalledWith({
      attributes: ["id"], where: { team_id: 7 }, transaction,
    });
    expect(db.AiMessage.destroy).toHaveBeenCalledWith({
      where: { conversation_id: { [Op.in]: ["conversation-7"] } }, transaction,
    });
    [db.AiUsage, db.AiConversation].forEach((model) => {
      expect(model.destroy).toHaveBeenCalledWith({ where: { team_id: 7 }, transaction });
      expect(model.destroy.mock.invocationCallOrder[0])
        .toBeLessThan(db.Team.destroy.mock.invocationCallOrder[0]);
    });
    [db.AiMessage, db.AiUsage].forEach((model) => {
      expect(model.destroy.mock.invocationCallOrder[0])
        .toBeLessThan(db.AiConversation.destroy.mock.invocationCallOrder[0]);
    });
    expect(transaction.commit).toHaveBeenCalledOnce();
    expect(transaction.rollback).not.toHaveBeenCalled();
  });

  it("rolls back when AI cleanup fails", async () => {
    db.AiMessage.destroy.mockRejectedValue(new Error("Delete failed"));

    await expect(controller.deleteTeam(7, 42)).rejects.toThrow("Delete failed");

    expect(db.Team.destroy).not.toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledOnce();
  });
});
