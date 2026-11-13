import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getModels } from "../helpers/dbHelpers.js";
import { testDbManager } from "../helpers/testDbManager.js";

const accounts = require("../../apps/slack/accounts");
const slackClient = require("../../apps/slack/utils/slackClient");
beforeEach(() => vi.spyOn(slackClient, "sendDM").mockResolvedValue({ ok: true }));
afterEach(() => vi.restoreAllMocks());

describe("Slack personal account persistence", () => {
  let db;
  beforeAll(async () => {
    if (!testDbManager.getSequelize()) await testDbManager.start();
    db = await getModels();
  });

  async function fixture(role = "teamViewer") {
    const team = await db.Team.create({ name: "Slack test" });
    const user = await db.User.create({ name: "Slack user", email: "slack@example.test", password: "test-password" });
    await db.TeamRole.create({ team_id: team.id, user_id: user.id, role });
    const integration = await db.Integration.create({ type: "slack", name: "Slack", external_id: "T1", team_id: team.id,
      config: { bot_token: "test", slack_team_name: "Test workspace" } });
    const token = "a".repeat(64);
    await db.SlackLinkToken.create({ token_hash: accounts.hashToken(token), integration_id: integration.id,
      team_id: team.id, slack_user_id: "U1", expires_at: new Date(Date.now() + 60000) });
    return { team, user, integration, token };
  }

  it.each(["teamOwner", "teamEditor", "teamViewer"])("links %s once and rejects a replay", async (role) => {
    const { user, integration, token } = await fixture(role);
    await expect(accounts.completeLink(token, user.id)).resolves.toMatchObject({ linked: true });
    await expect(accounts.completeLink(token, user.id)).rejects.toMatchObject({ statusCode: 400 });
    expect(await db.SlackAccount.count()).toBe(1);
    await accounts.unlink({ integration_id: integration.id, slack_user_id: "U1" });
    await expect(accounts.resolveAccount("T1", "U1")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a removed member without consuming the link", async () => {
    const { user, token } = await fixture();
    await db.TeamRole.destroy({ where: { user_id: user.id } });
    await expect(accounts.completeLink(token, user.id)).rejects.toMatchObject({ statusCode: 403 });
    expect(await db.SlackAccount.count()).toBe(0);
    expect(await db.SlackLinkToken.count()).toBe(1);
  });

  it("enforces durable request deduplication and preserves JSON", async () => {
    const { user, token } = await fixture();
    await accounts.completeLink(token, user.id);
    const account = await db.SlackAccount.findOne();
    const values = { request_key: "event-1", account_id: account.id, status: "queued", input: { question: "Revenue?" } };
    const request = await db.SlackRequest.create(values);
    await expect(db.SlackRequest.create(values)).rejects.toMatchObject({ name: "SequelizeUniqueConstraintError" });
    await request.update({ result: { message: "Answer", cards: [] }, messages: [{ channel: "D1", ts: "1" }] });
    expect((await request.reload()).result).toEqual({ message: "Answer", cards: [] });
    expect(request.messages).toEqual([{ channel: "D1", ts: "1" }]);
  });
});
