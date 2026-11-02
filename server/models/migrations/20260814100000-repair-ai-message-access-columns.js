const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("AiMessage");
    if (!columns.sensitive_workspace_context) {
      await queryInterface.addColumn("AiMessage", "sensitive_workspace_context", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!columns.workspace_access_version) {
      await queryInterface.addColumn("AiMessage", "workspace_access_version", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down() {},
};
