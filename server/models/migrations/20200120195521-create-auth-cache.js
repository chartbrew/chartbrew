module.exports = {
  up: (queryInterface, Sequelize) => {
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
        get: function () {
          return JSON.parse(this.getDataValue('user'));
        },
        set: function (user) {
          this.setDataValue('user', JSON.stringify(user));
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
  down: (queryInterface, Sequelize) => { // eslint-disable-line
    return queryInterface.dropTable("AuthCache");
  }
};
