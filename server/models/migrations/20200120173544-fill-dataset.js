module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn("Dataset", "fill", {
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
        queryInterface.removeColumn("Dataset", "fill", { transaction: t }),
      ]);
    });
  }
};
