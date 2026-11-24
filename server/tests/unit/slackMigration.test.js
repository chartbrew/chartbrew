import { describe, expect, it } from "vitest";

const { Sequelize, DataTypes } = require("sequelize");
const migration = require("../../models/migrations/20261105090000-add-slack-personal-accounts");

describe("Slack schema migration", () => {
  it("preserves old records and adds shared conversation identities", async () => {
    const database = new Sequelize({ dialect: "sqlite", storage: ":memory:", logging: false });
    try {
      await migration.up(database.getQueryInterface());
      const Account = require("../../models/models/slackaccount")(database, DataTypes);
      await database.getQueryInterface().createTable("AiConversation", { id: { type: DataTypes.UUID, primaryKey: true }, team_id: DataTypes.INTEGER, user_id: { type: DataTypes.INTEGER, allowNull: false } });
      await database.getQueryInterface().createTable("AiUsage", { id: { type: DataTypes.UUID, primaryKey: true }, conversation_id: DataTypes.UUID, createdAt: DataTypes.DATE });
      await require("../../models/migrations/20261112090000-slack-shared-conversations").up(database.getQueryInterface());
      const Request = require("../../models/models/slackrequest")(database, DataTypes);
      const fields = { integration_id: "installation", team_id: 1, slack_user_id: "U1", user_id: 1 };
      const account = await Account.create(fields);
      await expect(Account.create(fields)).rejects.toMatchObject({ name: "SequelizeUniqueConstraintError" });
      const request = await Request.create({ account_id: account.id, request_key: "event", status: "queued", input: { question: "Revenue?" } });
      await request.update({ result: { message: "Answer", cards: [] } });
      expect((await request.reload()).result.message).toBe("Answer");
      const Thread = require("../../models/models/slackthread")(database, DataTypes);
      const shared = { integration_id: "installation", shared_key: "shared", channel_id: "C1", thread_ts: "1", conversation_id: "conversation" };
      await Thread.create(shared);
      await expect(Thread.create(shared)).rejects.toMatchObject({ name: "SequelizeUniqueConstraintError" });
      await Request.create({ integration_id: "installation", request_key: "anonymous", status: "queued", input: { question: "Revenue?" } });
      expect(await Account.count()).toBe(1);
    } finally {
      await database.close();
    }
  });
});
