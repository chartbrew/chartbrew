/* oxlint-disable no-await-in-loop -- Schema changes and backfills must run in order. */
const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    for (const table of ["SlackThread", "SlackRequest"]) {
      await queryInterface.changeColumn(table, "account_id", { type: Sequelize.UUID, allowNull: true });
      await queryInterface.addColumn(table, "integration_id", { type: Sequelize.UUID, allowNull: true });
      await queryInterface.addColumn(table, "team_id", { type: Sequelize.INTEGER, allowNull: true });
      await queryInterface.addIndex(table, ["integration_id", "createdAt"]);
    }
    await queryInterface.addColumn("SlackThread", "shared_key", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addIndex("SlackThread", ["shared_key"], { unique: true });
    await queryInterface.changeColumn("AiConversation", "user_id", { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn("AiConversation", "integration_id", { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn("SlackRequest", "error", { type: Sequelize.TEXT, allowNull: true });
    for (const [name, definition] of Object.entries({
      source: { type: Sequelize.STRING, allowNull: false, defaultValue: "app" },
      integration_id: { type: Sequelize.UUID, allowNull: true },
      integration_request_id: { type: Sequelize.UUID, allowNull: true },
    })) await queryInterface.addColumn("AiUsage", name, definition);
    await queryInterface.addIndex("AiUsage", ["integration_id", "createdAt"]);
    const generator = queryInterface.queryGenerator;
    const q = (name) => generator.quoteIdentifier(name);
    // Keep old personal conversations for audit, without importing their history into shared threads.
    for (const table of ["SlackThread", "SlackRequest"]) {
      await queryInterface.sequelize.query(`UPDATE ${q(table)} SET ${q("integration_id")} = (SELECT ${q("integration_id")} FROM ${q("SlackAccount")} WHERE ${q("SlackAccount")}.${q("id")} = ${q(table)}.${q("account_id")})`);
    }
    await queryInterface.sequelize.query(`UPDATE ${q("SlackThread")} SET ${q("team_id")} = (SELECT ${q("team_id")} FROM ${q("AiConversation")} WHERE ${q("AiConversation")}.${q("id")} = ${q("SlackThread")}.${q("conversation_id")})`);
    await queryInterface.sequelize.query(`UPDATE ${q("SlackRequest")} SET ${q("team_id")} = (SELECT ${q("team_id")} FROM ${q("SlackAccount")} WHERE ${q("SlackAccount")}.${q("id")} = ${q("SlackRequest")}.${q("account_id")})`);
    await queryInterface.sequelize.query(`UPDATE ${q("AiUsage")} SET ${q("source")} = 'slack' WHERE ${q("conversation_id")} IN (SELECT ${q("conversation_id")} FROM ${q("SlackThread")})`);
    await queryInterface.sequelize.query(`UPDATE ${q("AiUsage")} SET ${q("integration_id")} = (SELECT ${q("integration_id")} FROM ${q("SlackThread")} WHERE ${q("SlackThread")}.${q("conversation_id")} = ${q("AiUsage")}.${q("conversation_id")} LIMIT 1) WHERE ${q("source")} = 'slack'`);
  },

  async down() {
    throw new Error("Shared Slack conversations cannot be converted back to personal conversations without losing audit history.");
  },
};
