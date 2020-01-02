module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.sequelize.transaction((t) => {
      return Promise.all([
        queryInterface.sequelize.query(`
          ALTER TABLE chart MODIFY connection_id INT NULL
        `),
        queryInterface.addColumn("Chart", "draft", {
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
        queryInterface.sequelize.query(`
          ALTER TABLE chart MODIFY connection_id INT NOT NULL
        `),
        queryInterface.removeColumn("Chart", "draft", { transaction: t }),
      ]);
    });
  },
};
