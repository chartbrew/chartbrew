const Sequelize = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("DataRequestCache", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      dr_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "DataRequest",
          key: "id",
          onDelete: "cascade",
        },
      },
      filePath: {
        type: Sequelize.STRING,
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

  down: async (queryInterface) => {
    await queryInterface.dropTable("DataRequestCache");
  }
};
