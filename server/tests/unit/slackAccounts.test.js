import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = require("../../models/models");
const accounts = require("../../apps/slack/accounts");
const slackClient = require("../../apps/slack/utils/slackClient");

beforeEach(() => vi.spyOn(slackClient, "sendDM").mockResolvedValue({ ok: true }));

afterEach(() => vi.restoreAllMocks());

describe("Slack personal account links", () => {
  it("rejects malformed and expired link tokens", async () => {
    expect(() => accounts.hashToken("not-a-token")).toThrow("expired");
    vi.spyOn(db.SlackLinkToken, "findOne").mockResolvedValue(null);
    await expect(accounts.inspectLink("a".repeat(64), 1)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("stores a digest instead of the bearer token", () => {
    const token = "a".repeat(64);
    expect(accounts.hashToken(token)).toHaveLength(64);
    expect(accounts.hashToken(token)).not.toBe(token);
  });

  it("does not create a link for a person outside the team", async () => {
    vi.spyOn(db.SlackLinkToken, "findOne").mockResolvedValue({ integration_id: "i", team_id: 7 });
    vi.spyOn(db.Integration, "findOne").mockResolvedValue({ config: { bot_token: "test" } });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue(null);
    const create = vi.spyOn(db.SlackAccount, "findOrCreate");
    await expect(accounts.inspectLink("a".repeat(64), 1)).rejects.toMatchObject({ statusCode: 403 });
    expect(create).not.toHaveBeenCalled();
  });

  it("consumes a single-use link inside the account transaction", async () => {
    const transaction = { LOCK: { UPDATE: "UPDATE" } };
    vi.spyOn(db.sequelize, "transaction").mockImplementation((callback) => callback(transaction));
    const state = { integration_id: "i", team_id: 7, slack_user_id: "U1", destroy: vi.fn() };
    vi.spyOn(db.SlackLinkToken, "findOne").mockResolvedValue(state);
    vi.spyOn(db.Integration, "findOne").mockResolvedValue({ id: "i", team_id: 7, config: { bot_token: "test", slack_team_name: "Sample" } });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamViewer", projects: [], Team: {} });
    vi.spyOn(db.SlackAccount, "findOrCreate").mockResolvedValue([{ user_id: 1, team_id: 7 }]);
    await expect(accounts.completeLink("a".repeat(64), 1)).resolves.toEqual({ linked: true, workspace: "Sample" });
    expect(state.destroy).toHaveBeenCalledWith({ transaction });
    expect(db.SlackLinkToken.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: "UPDATE", transaction }));
  });

  it("does not replace another person's existing link", async () => {
    vi.spyOn(db.sequelize, "transaction").mockImplementation((callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));
    const state = { integration_id: "i", team_id: 7, slack_user_id: "U1", destroy: vi.fn() };
    vi.spyOn(db.SlackLinkToken, "findOne").mockResolvedValue(state);
    vi.spyOn(db.Integration, "findOne").mockResolvedValue({ id: "i", team_id: 7, config: { bot_token: "test" } });
    vi.spyOn(db.TeamRole, "findOne").mockResolvedValue({ role: "teamViewer", projects: [], Team: {} });
    vi.spyOn(db.SlackAccount, "findOrCreate").mockResolvedValue([{ user_id: 2, team_id: 7 }]);
    await expect(accounts.completeLink("a".repeat(64), 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(state.destroy).not.toHaveBeenCalled();
  });

  it("requires a personal link even when the workspace has an API key", async () => {
    vi.spyOn(db.Integration, "findOne").mockResolvedValue({ id: "i", team_id: 7, apikey_id: "legacy", config: { bot_token: "test" } });
    vi.spyOn(db.SlackAccount, "findOne").mockResolvedValue(null);
    await expect(accounts.resolveAccount("T1", "U1")).rejects.toThrow("/chartbrew link");
  });
});
