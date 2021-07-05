const Sequelize = require("sequelize");

module.exports = {
  up: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn("Chart", "pagination", {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        }, { transaction: t }),
        queryInterface.addColumn("Chart", "items", {
          type: Sequelize.STRING,
          defaultValue: "limit",
        }, { transaction: t }),
        queryInterface.addColumn("Chart", "itemsLimit", {
          type: Sequelize.INTEGER,
          defaultValue: 1000,
        }, { transaction: t }),
        queryInterface.addColumn("Chart", "offset", {
          type: Sequelize.STRING,
          defaultValue: "offset",
        }, { transaction: t }),
      ])
        .catch(() => Promise.resolve("done"));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn("Chart", "pagination", { transaction: t }),
        queryInterface.removeColumn("Chart", "items", { transaction: t }),
        queryInterface.removeColumn("Chart", "itemsLimit", { transaction: t }),
        queryInterface.removeColumn("Chart", "offset", { transaction: t }),
      ]);
    });
  },
};
