const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("TeamRole", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        reference: {
          model: "User",
          key: "id",
          onDelete: "cascade",
        },
      },
      team_id: {
        type: Sequelize.INTEGER,
        reference: {
          model: "Team",
          key: "id",
          onDelete: "cascade",
        },
      },
      role: {
        type: Sequelize.STRING,
        defaultValue: "admin",
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
  down: (queryInterface) => {
    return queryInterface.dropTable("TeamRole");
  }
};
