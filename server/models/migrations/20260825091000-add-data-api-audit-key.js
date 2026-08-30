const Sequelize = require("sequelize");

const INDEX_NAME = "update_run_api_key_started_at";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("UpdateRun");
    if (!columns.apiKeyId) {
      await queryInterface.addColumn("UpdateRun", "apiKeyId", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex("UpdateRun");
    if (!indexes.some((index) => index.name === INDEX_NAME)) {
      await queryInterface.addIndex("UpdateRun", ["apiKeyId", "startedAt"], {
        name: INDEX_NAME,
      });
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex("UpdateRun");
    if (indexes.some((index) => index.name === INDEX_NAME)) {
      await queryInterface.removeIndex("UpdateRun", INDEX_NAME);
    }

    const columns = await queryInterface.describeTable("UpdateRun");
    if (columns.apiKeyId) {
      await queryInterface.removeColumn("UpdateRun", "apiKeyId");
    }
  },
};
