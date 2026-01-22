const Sequelize = require("sequelize");

module.exports = {
  async up(queryInterface) {
    // Add apikey_id field
    await queryInterface.addColumn("Integration", "apikey_id", {
      type: Sequelize.UUID,
      allowNull: true,
      reference: {
        model: "Apikey",
        key: "id",
        onDelete: "set null",
      },
    });

    // Add external_id field
    await queryInterface.addColumn("Integration", "external_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Make team_id nullable (for installations that aren't connected yet)
    await queryInterface.changeColumn("Integration", "team_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    });

    // Add composite unique index on (type, external_id)
    // Note: This allows multiple NULL values for external_id
    await queryInterface.addIndex("Integration", ["type", "external_id"], {
      unique: true,
      name: "integration_type_external_id_unique",
    });

    // Add index on external_id for fast lookups
    await queryInterface.addIndex("Integration", ["external_id"], {
      name: "integration_external_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("Integration", "integration_external_id_idx");
    await queryInterface.removeIndex("Integration", "integration_type_external_id_unique");
    await queryInterface.removeColumn("Integration", "external_id");
    await queryInterface.removeColumn("Integration", "apikey_id");
    await queryInterface.changeColumn("Integration", "team_id", {
      type: Sequelize.INTEGER,
      allowNull: false,
      reference: {
        model: "Team",
        key: "id",
        onDelete: "cascade",
      },
    });
  },
};
