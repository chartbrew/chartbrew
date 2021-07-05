module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Chart", "maxValue", {
      type: Sequelize.INTEGER,
    });
    await queryInterface.addColumn("Chart", "minValue", {
      type: Sequelize.INTEGER,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Chart", "maxValue");
    await queryInterface.removeColumn("Chart", "minValue");
  }
};
