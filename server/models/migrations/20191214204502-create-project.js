const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("Project", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Team",
          key: "id",
          onDelete: "cascade",
        },
      },
      name: {
        type: Sequelize.STRING,
      },
      brewName: {
        type: Sequelize.STRING,
        unique: true,
      },
      dashboardTitle: {
        type: Sequelize.STRING,
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
    return queryInterface.dropTable("Project");
  }
};
