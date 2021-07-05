const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("SavedQuery", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "Project",
          key: "id",
          onDelete: "cascade",
        },
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        reference: {
          model: "User",
          key: "id",
          onDelete: "cascade",
        },
      },
      summary: {
        type: Sequelize.STRING,
      },
      query: {
        type: Sequelize.TEXT,
      },
      type: {
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
    return queryInterface.dropTable("SavedQuery");
  }
};
