module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn("Chart", "draft", {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    });
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.changeColumn("Chart", "draft", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },
};
