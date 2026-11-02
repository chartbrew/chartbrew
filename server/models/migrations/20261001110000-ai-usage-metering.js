const Sequelize = require("sequelize");

const fields = {
  request_id: { type: Sequelize.UUID, allowNull: true },
  provider: { type: Sequelize.STRING, allowNull: true },
  provider_response_id: { type: Sequelize.STRING, allowNull: true },
  activity: { type: Sequelize.STRING, allowNull: false, defaultValue: "legacy" },
  usage_status: { type: Sequelize.STRING, allowNull: false, defaultValue: "legacy" },
  cached_tokens: { type: Sequelize.INTEGER, allowNull: true },
  reasoning_tokens: { type: Sequelize.INTEGER, allowNull: true },
  provider_usage: { type: Sequelize.JSON, allowNull: true },
};

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("AiUsage");
    for (const [name, definition] of Object.entries(fields)) {
      if (!columns[name]) {
        // oxlint-disable-next-line no-await-in-loop
        await queryInterface.addColumn("AiUsage", name, definition);
      }
    }
    const indexes = await queryInterface.showIndex("AiUsage");
    if (!indexes.some((index) => index.name === "ai_usage_request_id")) {
      await queryInterface.addIndex("AiUsage", ["request_id"], { name: "ai_usage_request_id" });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeIndex("AiUsage", ["request_id"]);
    for (const name of Object.keys(fields).reverse()) {
      // oxlint-disable-next-line no-await-in-loop
      await queryInterface.removeColumn("AiUsage", name);
    }
  },
};
