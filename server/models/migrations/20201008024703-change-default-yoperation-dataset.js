module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("Dataset", "yAxisOperation", {
      type: Sequelize.STRING,
      defaultValue: "none",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("Dataset", "yAxisOperation", {
      type: Sequelize.STRING,
    });
  }
};
