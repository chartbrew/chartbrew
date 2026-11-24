const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("SlackAccount", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      integration_id: { type: Sequelize.UUID, allowNull: false },
      team_id: { type: Sequelize.INTEGER, allowNull: false },
      slack_user_id: { type: Sequelize.STRING, allowNull: false },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("SlackAccount", ["integration_id", "slack_user_id"], {
      name: "slackaccount_identity", unique: true,
    });
    await queryInterface.createTable("SlackLinkToken", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      token_hash: { type: Sequelize.STRING, allowNull: false },
      integration_id: { type: Sequelize.UUID, allowNull: false },
      team_id: { type: Sequelize.INTEGER, allowNull: false },
      slack_user_id: { type: Sequelize.STRING, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("SlackLinkToken", ["token_hash"], {
      name: "slacklinktoken_identity", unique: true,
    });
    await queryInterface.createTable("SlackThread", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      account_id: { type: Sequelize.UUID, allowNull: false },
      channel_id: { type: Sequelize.STRING, allowNull: false },
      thread_ts: { type: Sequelize.STRING, allowNull: false },
      conversation_id: { type: Sequelize.UUID, allowNull: false },
      dm_channel: { type: Sequelize.STRING, allowNull: true },
      dm_thread_ts: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("SlackThread", ["account_id", "channel_id", "thread_ts"], {
      name: "slackthread_identity", unique: true,
    });
    await queryInterface.createTable("SlackRequest", {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      request_key: { type: Sequelize.STRING, allowNull: false },
      account_id: { type: Sequelize.UUID, allowNull: false },
      thread_id: { type: Sequelize.UUID, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: false },
      input: { type: Sequelize.TEXT("long"), allowNull: false },
      result: { type: Sequelize.TEXT("long"), allowNull: true },
      messages: { type: Sequelize.TEXT("long"), allowNull: true },
      progress_ts: { type: Sequelize.STRING, allowNull: true },
      access_version: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex("SlackRequest", ["request_key"], {
      name: "slackrequest_identity", unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("SlackRequest");
    await queryInterface.dropTable("SlackThread");
    await queryInterface.dropTable("SlackLinkToken");
    await queryInterface.dropTable("SlackAccount");
  },
};
