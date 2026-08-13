const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("OrchestratorActionAudit");
    if (!columns.session_binding_hash) {
      await queryInterface.addColumn(
        "OrchestratorActionAudit",
        "session_binding_hash",
        {
          type: Sequelize.STRING,
          allowNull: true,
        }
      );
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("OrchestratorActionAudit");
    if (columns.session_binding_hash) {
      await queryInterface.removeColumn(
        "OrchestratorActionAudit",
        "session_binding_hash"
      );
    }
  },
};
