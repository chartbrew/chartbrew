module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("DataRequest", "paginationField", {
      type: Sequelize.STRING,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("DataRequest", "paginationField");
  }
};
