module.exports = {
  up: (queryInterface, Sequelize) => {
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
  },
  down: (queryInterface) => {
    return queryInterface.dropTable("ChartConnections");
  }
};
