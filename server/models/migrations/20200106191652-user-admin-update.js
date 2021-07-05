const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn("User", "admin", {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        }, { transaction: t }),
      ])
        .catch(() => Promise.resolve("done"));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn("User", "admin", { transaction: t }),
      ]);
    });
  }
};
