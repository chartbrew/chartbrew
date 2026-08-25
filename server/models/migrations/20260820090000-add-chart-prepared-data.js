const Sequelize = require("sequelize");

const COLUMNS = {
  preparedData: {
    type: Sequelize.TEXT("long"),
    allowNull: true,
  },
  preparedDataFingerprint: {
    type: Sequelize.STRING(64),
    allowNull: true,
  },
  preparedDataSourceFingerprint: {
    type: Sequelize.STRING(64),
    allowNull: true,
  },
  preparedDataUpdatedAt: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  preparedDataVisualizationFingerprint: {
    type: Sequelize.STRING(64),
    allowNull: true,
  },
};

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface) {
    const columns = await queryInterface.describeTable("Chart");
    for (const [name, definition] of Object.entries(COLUMNS)) {
      if (!columns[name]) {
        await queryInterface.addColumn("Chart", name, definition); // oxlint-disable-line no-await-in-loop
      }
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("Chart");
    for (const name of Object.keys(COLUMNS).reverse()) {
      if (columns[name]) {
        await queryInterface.removeColumn("Chart", name); // oxlint-disable-line no-await-in-loop
      }
    }
  },
};
