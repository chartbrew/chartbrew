const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("AiMessage");
    if (!columns.workspace_access_scope) {
      await queryInterface.addColumn("AiMessage", "workspace_access_scope", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("AiMessage", "workspace_access_scope");
  },
};
