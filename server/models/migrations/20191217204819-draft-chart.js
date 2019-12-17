module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.addColumn("Chart", "draft", {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        }, { transaction: t }),
      ])
        .catch(() => Promise.resolve("done"));
    });
  },

  down: (queryInterface) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.removeColumn("Chart", "draft", { transaction: t }),
      ]);
    });
  },
};
