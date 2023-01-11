const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("AlertIntegration", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      alert_id: {
        type: Sequelize.UUID,
        allowNull: false,
        reference: {
          model: "Alert",
          key: "id",
          onDelete: "cascade",
        },
      },
      integration_id: {
        type: Sequelize.UUID,
        allowNull: false,
        reference: {
          model: "Integration",
          key: "id",
          onDelete: "cascade",
        },
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("AlertIntegration");
  }
};
