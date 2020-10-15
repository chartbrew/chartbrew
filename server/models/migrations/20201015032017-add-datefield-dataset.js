module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Dataset", "dateField", {
      type: Sequelize.STRING,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Dataset", "dateField");
  }
};
