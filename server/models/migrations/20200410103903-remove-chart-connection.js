const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.dropTable("ChartConnection");
  },

  down: (queryInterface) => {
    return queryInterface.createTable("ChartConnection", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      chart_id: {
        type: Sequelize.INTEGER
      },
      connection_id: {
        type: Sequelize.INTEGER,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  }
};
