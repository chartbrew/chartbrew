module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Dataset", "formula", {
      type: Sequelize.TEXT,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumb("Dataset", "formula");
  }
};
