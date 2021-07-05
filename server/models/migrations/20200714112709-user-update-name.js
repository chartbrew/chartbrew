const Sequelize = require("sequelize");

const migrateSurname = require("../scripts/migrateSurname");

module.exports = {
  up: async (queryInterface) => {
    return migrateSurname.up()
      .then(() => {
        return queryInterface.removeColumn("User", "surname");
      });
  },

  down: async (queryInterface) => {
    return queryInterface.addColumn("User", "surname", {
      type: Sequelize.STRING,
      allowNull: false,
    })
      .then(() => {
        return migrateSurname.down();
      });
  }
};
