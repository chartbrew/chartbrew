const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("ProjectRole", {
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
      project_id: {
        type: Sequelize.INTEGER,
        reference: {
          model: "Project",
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
      }
    });
  },
  down: (queryInterface) => {
    return queryInterface.dropTable("ProjectRole");
  }
};
