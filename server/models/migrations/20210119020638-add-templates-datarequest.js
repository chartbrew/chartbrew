module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("DataRequest", "template", {
      type: Sequelize.STRING,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("DataRequest", "template");
  },
};
