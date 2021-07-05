const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.createTable("AuthCache", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      user: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
        get() {
          return JSON.parse(this.getDataValue("user"));
        },
        set(user) {
          this.setDataValue("user", JSON.stringify(user));
        },
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
    return queryInterface.dropTable("AuthCache");
  }
};
