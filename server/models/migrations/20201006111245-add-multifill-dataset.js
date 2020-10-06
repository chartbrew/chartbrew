module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Dataset", "multiFill", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Dataset", "multiFill");
  },
};
