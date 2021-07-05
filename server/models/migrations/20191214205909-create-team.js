const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("Team", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
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
    return queryInterface.dropTable("Team");
  }
};
