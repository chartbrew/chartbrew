module.exports = {
  up: (queryInterface, Sequelize) => {
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
  down: (queryInterface, Sequelize) => { // eslint-disable-line
    return queryInterface.dropTable("ProjectRole");
  }
};
