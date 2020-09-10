module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("chart", "mode", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "chart",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("chart", "mode");
  }
};
