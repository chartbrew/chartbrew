module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("Chart", "mode", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "chart",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("Chart", "mode");
  }
};
